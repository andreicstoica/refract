"use client";

import { ModeToggle } from "../ui/mode-toggle";

export default function Header() {
  return (
    <div>
      <div className="flex flex-row items-center justify-between px-2 py-1">
        <ModeToggle />
      </div>
      <hr />
    </div>
  );
}
