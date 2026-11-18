import type { Metadata } from "next";
import { pageMeta } from "@/lib/meta";
import Link from "next/link";
import { LegalPage } from "@/components/LegalPage";

export const metadata: Metadata = pageMeta(
  "/terms",
  "Terms of Use · Kinfield",
  "The terms for using Kinfield's paper trading simulator, its agents and its open dataset.",
);

const EMAIL = "kinfieldlabs@proton.me";

export default function TermsPage() {
  return (
    <LegalPage title="Terms of Use" updated="17 November 2026">
      <p>
        These terms cover your use of kinfield.si, its simulator, the experimental agents and the open dataset. By
        using Kinfield you agree to them. If you don&apos;t, please don&apos;t use the site.
      </p>

      <h2>A simulator, not a broker</h2>
      <p>
        Every trade on Kinfield is simulated. No real funds are used, deposited or at risk, nothing you do here places
        an order on any exchange, and simulated balances have no cash value. Simulated fills use live Hyperliquid
        prices but can differ from what a real order would get, for example on slippage, liquidity and partial fills.
      </p>

      <h2>Not financial advice</h2>
      <p>
        Nothing on Kinfield is financial, investment or trading advice. That includes the agents, their confidence and
        trades, readiness checks, statistics and any content in the dataset. Simulated or past results don&apos;t
        predict future performance. Make your own decisions about real money, ideally with a qualified adviser.
      </p>

      <h2>The agents are experiments</h2>
      <p>
        Your agent is a small experimental model trained on your simulated trades, and it trades only its own simulated
        account. Its results, and passing any readiness check, are not a promise of skill, profit, funding or access to
        real capital. We may change, pause or reset agents as the project develops.
      </p>

      <h2>Your account</h2>
      <p>
        You sign in with GitHub and are responsible for activity on your account. Keep it to one account per person, and
        don&apos;t try to manipulate the ledger, the prices it uses, the dataset or other traders&apos; records.
      </p>

      <h2>What you share</h2>
      <p>
        Your trades stay yours. If you choose to share them in the open dataset, you license them, and any reasons you
        choose to share, under{" "}
        <a href="https://creativecommons.org/licenses/by/4.0/" target="_blank" rel="noopener noreferrer">
          CC BY 4.0
        </a>
        , so anyone may reuse them with credit. Stopping sharing removes your data from future publishes but can&apos;t
        withdraw copies already published. The <Link href="/privacy">privacy page</Link> has the details. Please
        don&apos;t write personal or sensitive information in trade reasons.
      </p>

      <h2>Fair use of the site</h2>
      <p>
        Don&apos;t attack, overload or probe the service, get around its limits, or use it to break the law. The source
        code is public on GitHub; these terms cover the hosted site.
      </p>

      <h2>Availability</h2>
      <p>
        Kinfield is an early project, provided as it is and as available. It may change, go down or lose data, and
        market data may be delayed or missing. We may suspend accounts that break these terms.
      </p>

      <h2>Liability</h2>
      <p>
        To the extent the law allows, Kinfield Labs isn&apos;t liable for losses arising from using the site, including
        decisions you make with real money based on anything you saw here.
      </p>

      <h2>Changes</h2>
      <p>
        We may update these terms. We&apos;ll change the date above, and for significant changes we&apos;ll say so on
        the site. Using Kinfield after a change means you accept the new terms.
      </p>

      <h2>Contact</h2>
      <p>
        Questions about these terms: <a href={`mailto:${EMAIL}`}>{EMAIL}</a>.
      </p>
    </LegalPage>
  );
}
