import { NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth";

const OPENROUTESERVICE_API_KEY = process.env.OPENROUTESERVICE_API_KEY;
const ORS_BASE_URL = "https://api.openrouteservice.org";

interface AutocompleteResult {
  features: Array<{
    properties: {
      label: string;
      name: string;
      country: string;
      region?: string;
      locality?: string;
    };
  }>;
}

export async function GET(req: Request) {
  try {
    const user = await getAuthUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!OPENROUTESERVICE_API_KEY) {
      return NextResponse.json({ suggestions: [] });
    }

    const { searchParams } = new URL(req.url);
    const query = searchParams.get("q");

    if (!query || query.length < 3) {
      return NextResponse.json({ suggestions: [] });
    }

    const url = new URL(`${ORS_BASE_URL}/geocode/autocomplete`);
    url.searchParams.set("api_key", OPENROUTESERVICE_API_KEY);
    url.searchParams.set("text", query);
    url.searchParams.set("size", "5");
    // Focus on Denmark and nearby countries
    url.searchParams.set("boundary.country", "DK,DE,SE,NO");

    const response = await fetch(url.toString());
    if (!response.ok) {
      console.error("[MILEAGE_AUTOCOMPLETE]", response.status);
      return NextResponse.json({ suggestions: [] });
    }

    const data: AutocompleteResult = await response.json();
    const suggestions = data.features?.map((f) => f.properties.label) || [];

    return NextResponse.json({ suggestions });
  } catch (error) {
    console.error("[MILEAGE_AUTOCOMPLETE]", error);
    return NextResponse.json({ suggestions: [] });
  }
}
