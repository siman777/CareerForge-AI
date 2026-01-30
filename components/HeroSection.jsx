import Link from "next/link";
import React from "react";
import { Button } from "./ui/button";
import Image from "next/image";

const HeroSection = () => {
  return (
    <section className="w-full pt-36 md:pt-48 pb-10 px-4">
      <div className="text-center space-y-6">
        <div className="space-y-6 mx-auto">
          <h1 className="gradient-title font-extrabold text-5xl md:text-6xl lg:text-6xl xl:text-8xl">
            Your AI Career Coach for
            <br/>
            Professional Success
          </h1>
          <p className="mx-auto max-w-[600px] text-muted-foreground md:text-xl">
            Advance your career with personalized guidence,interview prep, and
            AI-powered tool for job success.
          </p>
        </div>
        <div>
          <Link href="/dashboard">
            <Button size="lg" className="px-8" variant="default">
              Get Started
            </Button>
          </Link>
        </div>

        <div>
          <div>
            <Image
              src={"/banner.png"}
              width={1280}
              height={720}
              alt="dashboard preview"
              className="rounded-lg shadow-2xl border mx-auto"
              priority
            />
          </div>
        </div>
      </div>
    </section>
  );
};

export default HeroSection;
