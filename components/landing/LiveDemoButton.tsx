"use client";

import { useState } from "react";
import { useSignIn } from "@clerk/nextjs";

export function LiveDemoButton() {
  const [state, setState] = useState<"idle" | "loading" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState("");
  const { signIn, setActive } = useSignIn();

  async function handleClick() {
    if (state === "loading" || !signIn || !setActive) return;
    setState("loading");
    setErrorMsg("");

    try {
      const res = await fetch("/api/demo/create", { method: "POST" });
      const data = await res.json();

      if (!res.ok || !data.success) {
        throw new Error(data.error || "Noget gik galt");
      }

      // Use the sign-in token to authenticate directly
      const result = await signIn.create({
        strategy: "ticket",
        ticket: data.token,
      });

      if (result.status === "complete" && result.createdSessionId) {
        await setActive({ session: result.createdSessionId });
        window.location.href = "/dashboard";
      } else {
        throw new Error("Kunne ikke logge ind");
      }
    } catch (err: any) {
      setState("error");
      setErrorMsg(err.message || "Noget gik galt");
      setTimeout(() => {
        setState("idle");
        setErrorMsg("");
      }, 4000);
    }
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
      <button
        className="lp-btn lp-btn-demo lp-btn-lg"
        onClick={handleClick}
        disabled={state === "loading"}
      >
        {state === "loading" ? (
          <>
            <span className="lp-demo-spinner" />
            Klargør dit test-miljø…
          </>
        ) : (
          "Prøv med demodata"
        )}
      </button>
      {state === "error" ? (
        <p className="lp-demo-error">{errorMsg}</p>
      ) : (
        <p className="lp-demo-sub">Ingen oprettelse. Se systemet i brug.</p>
      )}
    </div>
  );
}
