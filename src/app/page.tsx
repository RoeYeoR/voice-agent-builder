import Link from "next/link";
import { ArrowRight, MessageSquareText, PhoneCall, CalendarCheck2 } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";

const steps = [
  {
    icon: MessageSquareText,
    title: "Describe the agent",
    body: "Chat in plain language and Claude designs its persona, script, and qualification criteria — for any use case.",
  },
  {
    icon: PhoneCall,
    title: "It calls your leads",
    body: "The generated assistant runs on real voice infrastructure — speech-to-text, an LLM, and natural voice, live on the phone.",
  },
  {
    icon: CalendarCheck2,
    title: "It books the meeting",
    body: "Once a lead is qualified and picks a time, the assistant checks a real calendar and reserves the slot on the spot.",
  },
];

export default function Home() {
  return (
    <div className="mx-auto flex max-w-3xl flex-col items-center gap-16 px-4 py-20 text-center sm:py-28">
      <div className="flex flex-col items-center gap-5">
        <span className="rounded-full border bg-secondary px-3 py-1 text-xs font-medium text-secondary-foreground">
          An AI that builds AI voice agents
        </span>
        <h1 className="max-w-xl text-4xl font-semibold tracking-tight sm:text-5xl">
          Describe the agent. It calls, qualifies, and books the meeting.
        </h1>
        <p className="max-w-lg text-balance text-muted-foreground">
          Chat with a builder agent to design a voice AI assistant — for real estate, sales,
          recruiting, or anything else. It calls real leads over the phone, qualifies them, and
          books a real meeting on a real calendar.
        </p>
        <div className="mt-2 flex items-center gap-3">
          <Link href="/builder" className={buttonVariants({ size: "lg" })}>
            Open the builder <ArrowRight className="size-4" />
          </Link>
          <Link href="/calls" className={buttonVariants({ size: "lg", variant: "outline" })}>
            See a call in action
          </Link>
        </div>
      </div>

      <div className="grid w-full grid-cols-1 gap-6 text-left sm:grid-cols-3">
        {steps.map((step, i) => (
          <div key={step.title} className="flex flex-col gap-3 rounded-xl border bg-card p-5">
            <div className="flex items-center gap-2">
              <span className="flex size-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <step.icon className="size-4" strokeWidth={2.25} />
              </span>
              <span className="text-xs font-medium text-muted-foreground">Step {i + 1}</span>
            </div>
            <h3 className="font-medium">{step.title}</h3>
            <p className="text-sm text-muted-foreground">{step.body}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
