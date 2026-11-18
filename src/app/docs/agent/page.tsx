import { Code, Doc, DocLink, docMeta, H2, H3, Note, Table } from "@/components/docs/Doc";

export const metadata = docMeta("agent");

export default function Page() {
  return (
    <Doc slug="agent">
      <p>
        Your agent is a small, deliberately simple model that learns from one person: you. Each trade you close is an
        example of a market you chose to act in and what price did next. From enough of them, the agent forms a view
        on which way the market leans in conditions like the ones in front of you.
      </p>
      <Note tone="warn" title="An experiment, not a trading system">
        <p>
          The agent is a logistic regression on six numbers. It is meant to be easy to understand and honest about what
          it knows, not to beat the market. Its views are not advice.
        </p>
      </Note>

      <H2 id="examples">What counts as an example</H2>
      <p>A closed trade teaches your agent when:</p>
      <ul>
        <li>its <DocLink to="market-context">market context</DocLink> was captured at entry, and</li>
        <li>it closed at a different price from where it opened.</li>
      </ul>
      <p>
        Each example pairs the six features at entry with a label: <strong>1 if price rose</strong> between entry and
        exit, <strong>0 if it fell</strong>. The label is the direction the market moved, not whether you made money:
        a winning long and a losing short both teach &ldquo;up&rdquo;. So the agent learns where the market went in
        the conditions you picked, including from your mistakes.
      </p>
      <p>
        Bigger moves teach more. Each example is weighted by the size of the move:
      </p>
      <Code>{`
weight = 1 + min(|exit / entry - 1| x 100, 4)      between 1 and 5
`}</Code>
      <p>A 0.5% move weighs 1.5; a move of 4% or more weighs 5.</p>

      <H2 id="training">How it is trained</H2>
      <ol>
        <li>Each feature is standardized: the mean is subtracted and the result divided by the standard deviation, across your examples.</li>
        <li>
          A logistic regression is fitted by weighted gradient descent: 400 passes, learning rate 0.15, with L2
          regularization of 0.05 to keep any one feature from dominating a small sample.
        </li>
        <li>In-sample accuracy is measured: how many of its own examples it now calls correctly.</li>
      </ol>
      <p>
        Training starts from the third example and takes a fraction of a second, so in the simulator the agent is
        retrained in your browser every time a trade closes.
      </p>

      <H2 id="prediction">How it forms a view</H2>
      <p>
        Given the market&apos;s current features, the model outputs the probability that price goes up. With few
        examples that number would overclaim, so it is pulled toward 50% until the agent has seen more:
      </p>
      <Code>{`
p      = sigmoid(bias + sum of weight[j] x standardized feature[j])
trust  = examples / (examples + 20)
p_long = 0.5 + (p - 0.5) x trust
`}</Code>
      <p>
        With 5 examples the agent keeps 20% of its raw conviction; with 20 examples, half; with 80, four fifths.
      </p>

      <H2 id="panel">Reading the agent panel</H2>
      <p>The <strong>Your agent</strong> tab under the chart shows:</p>
      <Table
        head={["Part", "Meaning"]}
        rows={[
          ["Examples", "How many of your closed trades it has learned from."],
          ["Agent view now", "Its probability of up on the market you are viewing, as Lean long (55% or more), Lean short (45% or less) or No edge in between, with a marker on a short-to-long bar."],
          ["In-sample accuracy", "How often it calls its own examples correctly. A high number on few trades usually means it memorized them."],
          ["What it has learned from you", "A bar per feature. Green pushes it toward long, red toward short; longer bars matter more."],
        ]}
      />
      <H3>An example of reading the weights</H3>
      <p>
        A long green bar on <strong>Range position</strong> and a red bar on <strong>Volatility</strong> would mean:
        in your trades, price tended to keep rising when it was near the top of its hourly range, and to fall when the
        market was jumpy. That is a summary of your history, not a rule about markets.
      </p>

      <H2 id="where">Where it learns</H2>
      <ul>
        <li>
          <strong>As a guest</strong>, the agent lives in your browser and learns from the trades saved there.
        </li>
        <li>
          <strong>Signed in</strong>, the panel learns from the trades on your current account. The agent that trades on
          its own learns from your closed trades on every account you have had, archived ones included.
        </li>
      </ul>

      <H2 id="limits">Its limits</H2>
      <ul>
        <li>It sees six numbers about the last hour. It knows nothing about news, funding, the order book or other markets.</li>
        <li>It learns from your choices, so it inherits your habits: if you only trade breakouts, it only knows breakouts.</li>
        <li>In-sample accuracy is not a forecast. The readiness checks judge the record, not the model.</li>
        <li>Strategy tags and reasons are not used yet. See <DocLink to="strategies" hash="used-for">Strategies and reasons</DocLink>.</li>
      </ul>
      <p>
        Once it has 30 examples on your account, the agent starts trading on its own:{" "}
        <DocLink to="autonomous">The agent trading on its own</DocLink>.
      </p>
    </Doc>
  );
}
