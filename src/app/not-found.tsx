import type { Metadata } from "next";
import Link from "next/link";
import { ConstellationButton } from "@/components/ConstellationButton";
import { StatusPage } from "@/components/StatusPage";

export const metadata: Metadata = { title: "Page not found · Kinfield", robots: { index: false } };

/** Shown for any address that doesn't exist. */
export default function NotFound() {
  return (
    <StatusPage
      label="404"
      title="This page isn't here."
      actions={
        <>
          <ConstellationButton href="/simulate">Launch simulator</ConstellationButton>
          <Link href="/" className="link-ghost t-label">
            Back to Kinfield
          </Link>
        </>
      }
    >
      The link may be mistyped, or the page may have moved.
    </StatusPage>
  );
}
