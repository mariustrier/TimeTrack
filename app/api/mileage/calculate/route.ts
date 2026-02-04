import { NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth";
import { validate } from "@/lib/validate";
import { calculateDistanceSchema } from "@/lib/schemas";
import { checkRateLimit } from "@/lib/rate-limit";

const OPENROUTESERVICE_API_KEY = process.env.OPENROUTESERVICE_API_KEY;
const ORS_BASE_URL = "https://api.openrouteservice.org";

interface GeocodingResult {
  features: Array<{
    geometry: {
      coordinates: [number, number]; // [lng, lat]
    };
    properties: {
      label: string;
    };
  }>;
}

interface DirectionsResult {
  routes: Array<{
    summary: {
      distance: number; // meters
    };
  }>;
}

async function geocodeAddress(address: string): Promise<[number, number] | null> {
  const url = new URL(`${ORS_BASE_URL}/geocode/search`);
  url.searchParams.set("api_key", OPENROUTESERVICE_API_KEY || "");
  url.searchParams.set("text", address);
  url.searchParams.set("size", "1");

  const response = await fetch(url.toString());
  if (!response.ok) {
    console.error("[MILEAGE] Geocoding failed:", response.status, await response.text());
    return null;
  }

  const data: GeocodingResult = await response.json();
  if (!data.features || data.features.length === 0) {
    return null;
  }

  return data.features[0].geometry.coordinates; // [lng, lat]
}

async function calculateRouteDistance(
  coordinates: [number, number][]
): Promise<number | null> {
  const url = `${ORS_BASE_URL}/v2/directions/driving-car`;

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: OPENROUTESERVICE_API_KEY || "",
    },
    body: JSON.stringify({
      coordinates,
    }),
  });

  if (!response.ok) {
    console.error("[MILEAGE] Directions failed:", response.status, await response.text());
    return null;
  }

  const data: DirectionsResult = await response.json();
  if (!data.routes || data.routes.length === 0) {
    return null;
  }

  const distanceMeters = data.routes[0].summary.distance;
  return distanceMeters / 1000; // Convert to kilometers
}

export async function POST(req: Request) {
  try {
    const user = await getAuthUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Rate limit: 20 requests per minute per company
    const rateLimitResponse = checkRateLimit(
      `mileage-calculate:${user.companyId}`,
      { maxRequests: 20, windowMs: 60000 }
    );
    if (rateLimitResponse) {
      return rateLimitResponse;
    }

    if (!OPENROUTESERVICE_API_KEY) {
      console.error("[MILEAGE] OPENROUTESERVICE_API_KEY not configured");
      return NextResponse.json(
        { error: "Distance calculation is not configured" },
        { status: 503 }
      );
    }

    const body = await req.json();
    const result = validate(calculateDistanceSchema, body);
    if (!result.success) return result.response;

    const { startAddress, endAddress, stops, roundTrip } = result.data;

    // Build list of all addresses: start -> stops -> end
    const allAddresses = [startAddress, ...(stops || []), endAddress];

    // Geocode all addresses in parallel
    const coordsResults = await Promise.all(
      allAddresses.map((addr) => geocodeAddress(addr))
    );

    // Check for geocoding failures
    for (let i = 0; i < coordsResults.length; i++) {
      if (!coordsResults[i]) {
        const addressType = i === 0 ? "start" : i === coordsResults.length - 1 ? "end" : `stop ${i}`;
        return NextResponse.json(
          { error: `Could not find ${addressType} address. Please try a more specific address.` },
          { status: 400 }
        );
      }
    }

    const coordinates = coordsResults as [number, number][];

    // Calculate driving distance through all waypoints
    const distanceKm = await calculateRouteDistance(coordinates);

    if (distanceKm === null) {
      return NextResponse.json(
        { error: "Could not calculate route between addresses." },
        { status: 400 }
      );
    }

    // Double distance if round trip
    const finalDistance = roundTrip ? distanceKm * 2 : distanceKm;

    return NextResponse.json({
      distanceKm: Math.round(finalDistance * 10) / 10, // Round to 1 decimal
    });
  } catch (error) {
    console.error("[MILEAGE_CALCULATE]", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
