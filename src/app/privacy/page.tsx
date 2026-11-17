import type { Metadata } from "next";
import { LegalPage } from "@/components/LegalPage";

export const metadata: Metadata = {
  title: "Privacy · Kinfield",
  description: "What Kinfield collects, where it goes, what becomes public, and how to have it removed.",
};

const EMAIL = "kinfieldlabs@proton.me";

export default function PrivacyPage() {
  return (
    <LegalPage title="Privacy" updated="17 November 2026">
      <p>
        Kinfield is a paper-trading simulator. This page explains what we collect, why, who else handles it, what can
        become public, and how to have your data removed. It covers kinfield.si and its simulator.
      </p>

      <h2>Without signing in</h2>
      <p>
        As a guest, your simulated trades, account balance and chart settings (indicators, drawings, the market and
        interval you last used) are stored only in your browser&apos;s local storage. They never reach our servers, and
        clearing your browser data removes them.
      </p>

      <h2>When you sign in with GitHub</h2>
      <p>Signing in creates an account with:</p>
      <ul>
        <li>your GitHub user ID, username, display name and avatar link, from GitHub;</li>
        <li>
          your simulated trades and orders, each with its price, size, leverage, times, the market conditions recorded
          when it opened, the strategy tag you chose and any reason you wrote;
        </li>
        <li>the trades your experimental agent makes on its own simulated account;</li>
        <li>your data sharing choices.</li>
      </ul>
      <p>
        We use this to run your simulated account, keep its record, train your agent, and publish the open dataset if
        you choose to share. We don&apos;t sell it, and we don&apos;t use it for advertising.
      </p>

      <h2>Cookies and tracking</h2>
      <p>
        We set one cookie: a sign-in session that lasts 30 days, holding a random token. Only a hash of that token is
        stored on our side. We don&apos;t use analytics, advertising or tracking cookies.
      </p>

      <h2>The open dataset</h2>
      <p>
        Signed-in traders are asked whether to share their trades in the public Kinfield dataset, and can change that
        at any time in sharing settings. If you share:
      </p>
      <ul>
        <li>your trades are published to a public GitHub repository under your agent&apos;s name, such as KIN001, not your GitHub name, unless you choose to show it;</li>
        <li>your written reasons stay private unless you also choose to share them; until then only a salted fingerprint of each reason is published, which can&apos;t be turned back into the text;</li>
        <li>the dataset is licensed CC BY 4.0, so anyone may copy and reuse it with credit.</li>
      </ul>
      <p>
        If you stop sharing, your data is removed from the dataset at the next publish. Earlier versions stay in the
        repository&apos;s history, and copies others already made can&apos;t be recalled, so please share only what
        you&apos;re comfortable being public for good.
      </p>

      <h2>Who else handles data</h2>
      <ul>
        <li>Vercel hosts the website and its servers.</li>
        <li>Railway hosts our database.</li>
        <li>GitHub handles sign-in and hosts the open dataset.</li>
        <li>
          Hyperliquid provides market data. Your browser connects to Hyperliquid directly for prices, so Hyperliquid
          sees your IP address as it would for any visitor to its public API.
        </li>
      </ul>
      <p>Each runs under its own privacy policy.</p>

      <h2>How long we keep it</h2>
      <p>
        Account data and trade records are kept while your account exists, because the record&apos;s value comes from
        being complete. Sign-in sessions expire after 30 days.
      </p>

      <h2>Your choices and rights</h2>
      <p>
        You can change what you share at any time. To get a copy of your data, correct it or delete your account,
        email <a href={`mailto:${EMAIL}`}>{EMAIL}</a> from the email on your GitHub account, or tell us your GitHub
        username. We&apos;ll delete your account and its records from our database and remove you from future dataset
        publishes; copies already published remain as described above.
      </p>

      <h2>Children</h2>
      <p>Kinfield isn&apos;t meant for anyone under 18.</p>

      <h2>Changes</h2>
      <p>
        If we change how we handle data, we&apos;ll update this page and its date. For significant changes we&apos;ll
        say so on the site.
      </p>

      <h2>Contact</h2>
      <p>
        Questions about privacy: <a href={`mailto:${EMAIL}`}>{EMAIL}</a>.
      </p>
    </LegalPage>
  );
}
