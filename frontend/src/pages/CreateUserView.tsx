import { FormEvent, useState } from "react";
import { usersApi } from "../api/users";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";

interface CreateUserViewProps {
  onCreated: () => void;
}

/** One-time setup screen: names the single local User profile for this installation. */
export function CreateUserView({ onCreated }: CreateUserViewProps) {
  const [displayName, setDisplayName] = useState("");

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!displayName.trim()) return;
    await usersApi.create({ display_name: displayName.trim() });
    onCreated();
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-6">
      <Card className="w-full max-w-md animate-fade-in">
        <CardHeader>
          <CardTitle className="text-2xl">Welcome</CardTitle>
          <CardDescription>Name this coder profile. Bookmarks are tied to it on this installation.</CardDescription>
        </CardHeader>
        <CardContent>
          <form className="flex flex-col gap-4" onSubmit={handleSubmit}>
            <Input
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="Your name (e.g. Coder A)"
              autoFocus
            />
            <Button type="submit">Continue</Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
