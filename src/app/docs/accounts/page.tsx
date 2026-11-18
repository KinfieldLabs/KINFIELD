import { Doc, DocLink, docMeta, H2, Note, Table } from "@/components/docs/Doc";

export const metadata = docMeta("accounts");

const yes = "Yes";
const no = "No";

export default function Page() {
  return (
    <Doc slug="accounts">
      <p>
        You can use Kinfield in two ways: as a guest, with everything kept in your browser, or signed in with GitHub,
        with your trades kept on Kinfield&apos;s server on a record that can be verified.
      </p>

      <H2 id="compare">Guest or signed in</H2>
      <Table
        head={["", "Guest", "Signed in"]}
        rows={[
          ["Starting capital", "$100,000", "$100,000"],
          ["Every Hyperliquid perpetual, live data", yes, yes],
          ["Market orders", yes, yes],
          ["Limit orders", no, yes],
          ["Take profit, stop loss, liquidation", "Checked while the page is open", "Replayed against price history, even while you are away"],
          ["Who prices the fill", "Your browser", "Kinfield's server, from Hyperliquid"],
          ["Where trades are kept", "Your browser's local storage", "Kinfield's database, on a hash-chained ledger"],
          ["Your agent learns from your trades", yes, yes],
          ["Agent trades its own account", no, "After 30 closed trades"],
          ["Readiness checks at /agent", no, yes],
          ["Open dataset", no, "If you opt in"],
          ["Export trades as JSONL", yes, yes],
        ]}
      />

      <H2 id="guest">Guest mode</H2>
      <p>
        Guest mode needs nothing from you. Your balance, positions and trade history are saved in your browser&apos;s
        local storage, along with your chart settings. They never reach Kinfield&apos;s servers, so clearing your
        browser data, or switching browser or device, starts you over. Guest trades can&apos;t be moved to an account
        later.
      </p>
      <p>
        Because the browser decides guest fills and triggers, a guest&apos;s take profit, stop loss and liquidation are
        only checked while the simulator is open. Use the <strong>Export .jsonl</strong> button in Trade history to keep
        a copy of your trades.
      </p>

      <H2 id="sign-in">Signing in with GitHub</H2>
      <p>
        Choose <strong>Sign in with GitHub</strong> in the simulator. Kinfield requests your public profile only (your
        GitHub user ID, username, display name and avatar), never your email, repositories or any write access.
      </p>
      <ul>
        <li>A sign-in lasts 30 days. It is one httpOnly cookie holding a random token; only a hash of that token is stored.</li>
        <li>Signing out deletes the session on the server as well as the cookie.</li>
        <li>Kinfield sets no analytics, advertising or tracking cookies.</li>
      </ul>

      <H2 id="agent-names">Your agent&apos;s name</H2>
      <p>
        Every signed-in person&apos;s agent is named in Kinfield&apos;s own series, <code>KIN001</code>,{" "}
        <code>KIN002</code> and on, in the order people first sign in. Names are assigned, never chosen, so the open
        dataset stays pseudonymous and no agent can pose as another. Your GitHub username appears next to your agent
        only if you choose to show it.
      </p>

      <H2 id="reset">Resetting your account</H2>
      <p>
        The <strong>Reset</strong> link in the Account panel, under the order ticket, starts over with $100,000. As a
        guest that clears your browser&apos;s trade log. Signed in, the link reads <strong>New account</strong> and
        never deletes anything: the old account is archived with its full ledger, it stays on the record at{" "}
        <a href="/agent">/agent</a>, and if you share, it is still published. You can reset up to 10 times a day.
      </p>
      <Note>
        <p>
          Archived accounts keep teaching your agent: it learns from your closed trades across all of your accounts.
        </p>
      </Note>

      <H2 id="sharing">Sharing settings</H2>
      <p>
        After you first sign in, Kinfield asks once whether to share your trades in the open dataset. Nothing is
        published before you answer. You can change any of these at any time from the <strong>Sharing on</strong> or{" "}
        <strong>Sharing off</strong> button next to your name at the top right of the simulator:
      </p>
      <ul>
        <li>
          <strong>Share my trades</strong>: publish your trades and ledger under your agent&apos;s name.
        </li>
        <li>
          <strong>Show my GitHub username</strong>: list your username next to your agent.
        </li>
        <li>
          <strong>Share my written reasons</strong>: publish the text of your reasons. Off, only a commitment that proves
          the reason was never changed is published.
        </li>
      </ul>
      <p>
        Turning sharing off removes your agent&apos;s folder at the next nightly publish. See{" "}
        <DocLink to="dataset">The open dataset</DocLink>.
      </p>

      <H2 id="delete">Deleting your account</H2>
      <p>
        In the sharing settings, choose <strong>Delete account</strong> and type your GitHub username to confirm. That
        removes your simulated accounts, positions, orders, ledger, agent and sessions from Kinfield&apos;s database at
        once, and signs you out.
      </p>
      <p>
        If your trades were ever published, a placeholder user row with no GitHub details is kept so the next publish
        knows to remove your agent&apos;s folder from the dataset. Earlier versions stay in the dataset
        repository&apos;s git history, and copies others already made can&apos;t be recalled. The{" "}
        <a href="/privacy">Privacy Policy</a> has the full details.
      </p>
    </Doc>
  );
}
