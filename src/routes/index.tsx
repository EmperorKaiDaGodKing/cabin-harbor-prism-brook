import { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { AgeDeclined, AgeGate, Opening } from "@/components/frank/age-gate";
import { FrankChat } from "@/components/frank/chat";
import { loadAdultOk, saveAdultOk } from "@/lib/frank";

export const Route = createFileRoute("/")({ component: Home });

type Phase = "pending" | "gate" | "declined" | "chat";

function Home() {
  const [phase, setPhase] = useState<Phase>("pending");

  useEffect(() => {
    setPhase(loadAdultOk() ? "chat" : "gate");
  }, []);

  switch (phase) {
    case "pending":
      return <Opening />;
    case "gate":
      return (
        <AgeGate
          onConfirm={() => {
            saveAdultOk();
            setPhase("chat");
          }}
          onLeave={() => setPhase("declined")}
        />
      );
    case "declined":
      return <AgeDeclined onBack={() => setPhase("gate")} />;
    case "chat":
      return <FrankChat />;
    default: {
      const exhaustive: never = phase;
      return exhaustive;
    }
  }
}
