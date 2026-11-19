
"use client";

import Link from "next/link";
import { SignInButton, SignUpButton } from "@clerk/nextjs";
import { Button } from "@/components/ui/button";

export default function Home() {
  return (
    <main className="min-h-screen bg-[#09090b] text-white">
      {/* Navbar */}
      <nav className="flex items-center justify-between px-8 py-6 max-w-7xl mx-auto">
        <Link href="/" className="text-2xl font-bold tracking-tight">
          Code<span className="text-blue-500">Critic</span>
        </Link>

        <div className="flex items-center gap-3">
          <SignInButton>
            <Button variant="ghost" className="text-white hover:text-blue-400">
              Sign In
            </Button>
          </SignInButton>

          <SignUpButton>
            <Button className="bg-blue-600 hover:bg-blue-700">
              Get Started
            </Button>
          </SignUpButton>
        </div>
      </nav>

      {/* Hero */}
      <section className="max-w-7xl mx-auto px-8 pt-28 pb-24 text-center">
        <div className="inline-flex items-center rounded-full border border-blue-500/30 bg-blue-500/10 px-4 py-2 text-sm text-blue-400 mb-8">
          AI-powered code reviews for modern teams
        </div>

        <h1 className="text-5xl md:text-7xl font-bold tracking-tight leading-tight">
          Ship better code.
          <br />
          <span className="text-blue-500">With every pull request.</span>
        </h1>

        <p className="mt-8 max-w-2xl mx-auto text-lg text-zinc-400 leading-relaxed">
          CodeCritic analyzes your GitHub repositories, reviews pull requests,
          catches potential bugs, and helps developers write cleaner,
          more secure code.
        </p>

        <div className="flex flex-col sm:flex-row justify-center gap-4 mt-10">
          <SignUpButton>
            <Button size="lg" className="bg-blue-600 hover:bg-blue-700 px-8">
              Start Building →
            </Button>
          </SignUpButton>

          <SignInButton>
            <Button
              size="lg"
              variant="outline"
              className="border-zinc-700 bg-transparent text-white hover:bg-zinc-800 px-8"
            >
              Sign In
            </Button>
          </SignInButton>
        </div>
      </section>

      {/* Features */}
      <section className="max-w-7xl mx-auto px-8 pb-28">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {[
            {
              icon: "🔍",
              title: "Intelligent PR Reviews",
              description:
                "Automatically analyze pull requests and identify bugs, security vulnerabilities, and code quality issues.",
            },
            {
              icon: "🧠",
              title: "Repository Intelligence",
              description:
                "Understand your entire codebase with AI-powered indexing and contextual repository search.",
            },
            {
              icon: "⚡",
              title: "Actionable Feedback",
              description:
                "Get meaningful suggestions and actionable feedback to improve your code before merging.",
            },
          ].map((feature) => (
            <div
              key={feature.title}
              className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-8 hover:border-blue-500/50 transition-colors"
            >
              <div className="text-3xl mb-5">{feature.icon}</div>
              <h3 className="text-xl font-semibold mb-3">
                {feature.title}
              </h3>
              <p className="text-zinc-400 leading-relaxed">
                {feature.description}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-zinc-800 py-8 text-center text-sm text-zinc-500">
        © {new Date().getFullYear()} CodeCritic. Built for developers.
      </footer>
    </main>
  );
}
