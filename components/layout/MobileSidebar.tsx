"use client";

import { Menu } from "lucide-react";

import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";

import { Button } from "@/components/ui/button";

import Navigation from "./Navigation";

export default function MobileSidebar() {
  return (
    <div className="md:hidden">
      <Sheet>
        <SheetTrigger
          render={
            <Button
              variant="ghost"
              size="icon"
            />
          }
        >
          <Menu className="h-6 w-6" />
        </SheetTrigger>

        <SheetContent side="right" className="w-72 p-0">
          <SheetHeader className="border-b border-zinc-800 bg-zinc-900">
            <SheetTitle className="text-left text-xl">
              🐙 Octopus
            </SheetTitle>
          </SheetHeader>

          <div className="p-4">
            <Navigation />
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}