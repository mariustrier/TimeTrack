"use client";

import Link from "next/link";
import {
  Clock,
  BarChart3,
  Users,
  Zap,
  TrendingUp,
  Shield,
  ArrowRight,
  Check,
} from "lucide-react";

function Navbar() {
  return (
    <nav className="fixed top-0 z-50 w-full border-b border-white/10 bg-brand-950/80 backdrop-blur-lg">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        <Link href="/" className="flex items-center gap-2">
          <Clock className="h-7 w-7 text-brand-400" />
          <span className="text-xl font-bold text-white">TimeTrack</span>
        </Link>
        <div className="hidden items-center gap-8 md:flex">
          <a href="#features" className="text-sm text-slate-300 hover:text-white transition-colors">Features</a>
          <a href="#pricing" className="text-sm text-slate-300 hover:text-white transition-colors">Pricing</a>
        </div>
        <div className="flex items-center gap-3">
          <Link
            href="/sign-in"
            className="text-sm text-slate-300 hover:text-white transition-colors"
          >
            Sign In
          </Link>
          <Link
            href="/sign-up"
            className="rounded-lg bg-brand-500 px-4 py-2 text-sm font-medium text-white hover:bg-brand-600 transition-colors"
          >
            Get Started
          </Link>
        </div>
      </div>
    </nav>
  );
}

function Hero() {
  return (
    <section className="gradient-bg relative overflow-hidden pt-32 pb-20 lg:pt-40 lg:pb-32">
      <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHZpZXdCb3g9IjAgMCA2MCA2MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZyBmaWxsPSJub25lIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiPjxnIGZpbGw9IiNmZmYiIGZpbGwtb3BhY2l0eT0iMC4wNSI+PGNpcmNsZSBjeD0iMzAiIGN5PSIzMCIgcj0iMS41Ii8+PC9nPjwvZz48L3N2Zz4=')] opacity-50" />
      <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-3xl text-center">
          <h1 className="text-4xl font-extrabold tracking-tight text-white sm:text-5xl lg:text-6xl">
            Track Time.{" "}
            <span className="text-brand-200">Boost Profit.</span>
          </h1>
          <p className="mt-6 text-lg text-brand-100/80 sm:text-xl">
            The modern time tracking platform built for agencies and consultancies.
            Know exactly where your time goes and how profitable each project is.
          </p>
          <div className="mt-10 flex flex-col items-center gap-4 sm:flex-row sm:justify-center">
            <Link
              href="/sign-up"
              className="inline-flex items-center gap-2 rounded-lg bg-white px-8 py-3.5 text-sm font-semibold text-brand-700 shadow-lg hover:bg-brand-50 transition-all"
            >
              Start Free Trial
              <ArrowRight className="h-4 w-4" />
            </Link>
            <a
              href="#features"
              className="inline-flex items-center gap-2 rounded-lg border border-white/20 px-8 py-3.5 text-sm font-semibold text-white hover:bg-white/10 transition-all"
            >
              See Features
            </a>
          </div>
        </div>
      </div>
    </section>
  );
}

function ProblemSection() {
  const problems = [
    {
      icon: Clock,
      title: "Lost Hours",
      description:
        "Teams waste hours every week on manual time tracking with spreadsheets and outdated tools.",
    },
    {
      icon: TrendingUp,
      title: "Invisible Costs",
      description:
        "Without real-time profitability data, unprofitable projects drain your bottom line silently.",
    },
    {
      icon: Users,
      title: "Team Blind Spots",
      description:
        "Managers can't see who's overloaded and who has capacity, leading to burnout and missed deadlines.",
    },
  ];

  return (
    <section className="bg-muted/50 py-20 lg:py-28">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
            Time Tracking Shouldn&apos;t Be This Hard
          </h2>
          <p className="mt-4 text-lg text-muted-foreground">
            Most teams struggle with these common challenges.
          </p>
        </div>
        <div className="mt-16 grid gap-8 sm:grid-cols-3">
          {problems.map((problem) => (
            <div
              key={problem.title}
              className="rounded-xl border border-border bg-card p-8 shadow-sm"
            >
              <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-red-50">
                <problem.icon className="h-6 w-6 text-red-500" />
              </div>
              <h3 className="mt-4 text-lg font-semibold text-foreground">
                {problem.title}
              </h3>
              <p className="mt-2 text-muted-foreground">{problem.description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function FeaturesSection() {
  const features = [
    {
      icon: Zap,
      title: "One-Click Time Entry",
      description:
        "Log hours in seconds with our intuitive weekly timesheet grid. No more forgetting to track time.",
      color: "bg-brand-50 text-brand-600",
    },
    {
      icon: BarChart3,
      title: "Real-Time Profitability",
      description:
        "See revenue, costs, and profit per employee and project instantly. Make data-driven decisions.",
      color: "bg-emerald-50 text-emerald-600",
    },
    {
      icon: Shield,
      title: "Team Management",
      description:
        "Manage your team, set rates, track utilization, and export data backups with ease.",
      color: "bg-amber-50 text-amber-600",
    },
  ];

  return (
    <section id="features" className="bg-background py-20 lg:py-28">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
            Everything You Need to Track Time
          </h2>
          <p className="mt-4 text-lg text-muted-foreground">
            Powerful features designed for modern teams.
          </p>
        </div>
        <div className="mt-16 grid gap-8 sm:grid-cols-3">
          {features.map((feature) => (
            <div
              key={feature.title}
              className="group rounded-xl border border-border bg-card p-8 shadow-sm transition-all hover:shadow-md"
            >
              <div
                className={`flex h-12 w-12 items-center justify-center rounded-lg ${feature.color}`}
              >
                <feature.icon className="h-6 w-6" />
              </div>
              <h3 className="mt-4 text-lg font-semibold text-foreground">
                {feature.title}
              </h3>
              <p className="mt-2 text-muted-foreground">{feature.description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function PricingSection() {
  const plans = [
    {
      name: "Starter",
      price: "$15",
      description: "Perfect for small teams getting started.",
      features: [
        "Up to 10 team members",
        "Unlimited projects",
        "Weekly timesheet",
        "Basic reporting",
        "CSV exports",
      ],
      cta: "Start Free Trial",
      popular: false,
    },
    {
      name: "Pro",
      price: "$25",
      description: "For growing teams that need advanced features.",
      features: [
        "Unlimited team members",
        "Unlimited projects",
        "Advanced timesheet",
        "Profitability analytics",
        "ZIP data backups",
        "Admin dashboard",
        "Priority support",
      ],
      cta: "Start Free Trial",
      popular: true,
    },
  ];

  return (
    <section id="pricing" className="bg-muted/50 py-20 lg:py-28">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
            Simple, Transparent Pricing
          </h2>
          <p className="mt-4 text-lg text-muted-foreground">
            Per user, per month. No hidden fees.
          </p>
        </div>
        <div className="mx-auto mt-16 grid max-w-4xl gap-8 lg:grid-cols-2">
          {plans.map((plan) => (
            <div
              key={plan.name}
              className={`relative rounded-2xl border bg-card p-8 shadow-sm ${
                plan.popular
                  ? "border-brand-500 ring-1 ring-brand-500"
                  : "border-border"
              }`}
            >
              {plan.popular && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                  <span className="rounded-full bg-brand-500 px-4 py-1 text-xs font-semibold text-white">
                    Most Popular
                  </span>
                </div>
              )}
              <h3 className="text-lg font-semibold text-foreground">
                {plan.name}
              </h3>
              <p className="mt-1 text-sm text-muted-foreground">{plan.description}</p>
              <div className="mt-6">
                <span className="text-4xl font-bold text-foreground">
                  {plan.price}
                </span>
                <span className="text-muted-foreground">/user/mo</span>
              </div>
              <ul className="mt-8 space-y-3">
                {plan.features.map((feature) => (
                  <li key={feature} className="flex items-center gap-3">
                    <Check className="h-4 w-4 text-brand-500" />
                    <span className="text-sm text-muted-foreground">{feature}</span>
                  </li>
                ))}
              </ul>
              <Link
                href="/sign-up"
                className={`mt-8 block rounded-lg py-3 text-center text-sm font-semibold transition-colors ${
                  plan.popular
                    ? "bg-brand-500 text-white hover:bg-brand-600"
                    : "bg-muted text-foreground hover:bg-accent"
                }`}
              >
                {plan.cta}
              </Link>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function CTASection() {
  return (
    <section className="gradient-bg py-20 lg:py-28">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-3xl font-bold tracking-tight text-white sm:text-4xl">
            Ready to Take Control of Your Time?
          </h2>
          <p className="mt-4 text-lg text-brand-100/80">
            Join teams who track smarter, not harder. Start your free trial today.
          </p>
          <div className="mt-10">
            <Link
              href="/sign-up"
              className="inline-flex items-center gap-2 rounded-lg bg-white px-8 py-3.5 text-sm font-semibold text-brand-700 shadow-lg hover:bg-brand-50 transition-all"
            >
              Get Started for Free
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}

function Footer() {
  return (
    <footer className="bg-brand-950 py-12">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col items-center justify-between gap-6 sm:flex-row">
          <div className="flex items-center gap-2">
            <Clock className="h-6 w-6 text-brand-400" />
            <span className="text-lg font-bold text-white">TimeTrack</span>
          </div>
          <p className="text-sm text-slate-400">
            &copy; {new Date().getFullYear()} TimeTrack. All rights reserved.
          </p>
        </div>
      </div>
    </footer>
  );
}

export default function LandingPage() {
  return (
    <main>
      <Navbar />
      <Hero />
      <ProblemSection />
      <FeaturesSection />
      <PricingSection />
      <CTASection />
      <Footer />
    </main>
  );
}
