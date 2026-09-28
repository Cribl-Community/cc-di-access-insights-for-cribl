import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import directoryGraphImg from '../assets/help/directory-graph.jpg';
import accessCheckImg from '../assets/help/access-check.jpg';
import './HelpPage.css';
import './Page.css';

// ---------------------------------------------------------------------------
// Small building blocks
// ---------------------------------------------------------------------------

function Figure({ src, alt, caption }: { src: string; alt: string; caption: string }) {
  return (
    <figure className="help-figure">
      <img src={src} alt={alt} loading="lazy" />
      <figcaption>{caption}</figcaption>
    </figure>
  );
}

function Steps({ children }: { children: ReactNode }) {
  return <ol className="help-steps">{children}</ol>;
}

function Note({ kind = 'note', children }: { kind?: 'note' | 'tip' | 'limit'; children: ReactNode }) {
  const label = kind === 'tip' ? 'Tip' : kind === 'limit' ? 'Limitation' : 'Note';
  return (
    <aside className={`help-note help-note-${kind}`}>
      <strong>{label}</strong>
      <div>{children}</div>
    </aside>
  );
}

function Ui({ children }: { children: ReactNode }) {
  return <span className="help-ui">{children}</span>;
}

interface Section {
  id: string;
  title: string;
  children?: Array<{ id: string; title: string }>;
}

const TOC: Section[] = [
  {
    id: 'introduction',
    title: 'About the app',
    children: [
      { id: 'why-hard', title: 'Why access is hard to see' },
      { id: 'what-it-is', title: 'What Access Insights is' },
      { id: 'who-its-for', title: 'Who it’s for' },
    ],
  },
  { id: 'features', title: 'Features at a glance' },
  {
    id: 'use-cases',
    title: 'Common tasks',
    children: [
      { id: 'uc-review', title: 'Access reviews & audits' },
      { id: 'uc-why', title: '“Why can / can’t they…?”' },
      { id: 'uc-onboard', title: 'Onboarding & role changes' },
      { id: 'uc-offboard', title: 'Offboarding & hygiene' },
      { id: 'uc-privilege', title: 'Least privilege' },
    ],
  },
  { id: 'layout', title: 'Finding your way around' },
  { id: 'dashboard', title: 'Dashboard' },
  { id: 'directory', title: 'Directory & access graph' },
  { id: 'access-check', title: 'Access Check' },
  { id: 'query', title: 'Query' },
  { id: 'worker-groups', title: 'Worker Group lookup' },
  {
    id: 'concepts',
    title: 'Concepts',
    children: [
      { id: 'model', title: 'Cribl’s permission model' },
      { id: 'sources', title: 'How access is granted' },
      { id: 'levels', title: 'Access levels' },
    ],
  },
  { id: 'data', title: 'Data, permissions & limitations' },
  { id: 'faq', title: 'FAQ & troubleshooting' },
  { id: 'support', title: 'Support' },
];

// ---------------------------------------------------------------------------

export function HelpPage() {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState('introduction');

  // Highlight the contents entry for the last heading scrolled past.
  useEffect(() => {
    const root = scrollRef.current;
    if (!root) return;
    const ids = TOC.flatMap((s) => [s.id, ...(s.children ?? []).map((c) => c.id)]);
    const onScroll = () => {
      const line = root.getBoundingClientRect().top + 80;
      let current = ids[0];
      for (const id of ids) {
        const el = document.getElementById(id);
        if (el && el.getBoundingClientRect().top <= line) current = id;
      }
      // The last section is too short to reach the top; at the bottom, it's the one in view.
      if (root.scrollTop + root.clientHeight >= root.scrollHeight - 4) current = ids[ids.length - 1];
      setActive(current);
    };
    onScroll();
    root.addEventListener('scroll', onScroll, { passive: true });
    return () => root.removeEventListener('scroll', onScroll);
  }, []);

  const jump = (id: string) => {
    document.getElementById(id)?.scrollIntoView({ block: 'start' });
    setActive(id);
  };

  return (
    <div className="help-page" ref={scrollRef}>
      <div className="help-layout">
        <nav className="help-toc" aria-label="Help contents">
          <span className="help-toc-title">Contents</span>
          <ul>
            {TOC.map((s) => (
              <li key={s.id}>
                <button type="button" className={active === s.id ? 'is-active' : undefined} onClick={() => jump(s.id)}>
                  {s.title}
                </button>
                {s.children && (
                  <ul>
                    {s.children.map((c) => (
                      <li key={c.id}>
                        <button type="button" className={active === c.id ? 'is-active' : undefined} onClick={() => jump(c.id)}>
                          {c.title}
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </li>
            ))}
          </ul>
        </nav>

        <article className="help-doc">
          <header className="help-hero">
            <h1>Access Insights for Cribl — Help</h1>
            <p>
              What the app is for, how each page works, and exactly where its data comes from.
            </p>
          </header>

          {/* ------------------------------------------------------------ */}
          <section id="introduction">
            <h2>About the app</h2>

            <h3 id="why-hard">Why access is hard to see</h3>
            <p>
              In Cribl, what a person can do is decided by several separate things at once:
            </p>
            <ul>
              <li>Roles assigned directly to their account, at the Organization, Workspace, or product level.</li>
              <li>Roles they inherit from every Team they belong to.</li>
              <li>Workspace-scoped roles (Cribl.Cloud).</li>
              <li>Access-control grants on individual Worker Groups, Fleets, and resources (datasets, dashboards, …).</li>
              <li>Inheritance: an Organization or Workspace admin is Admin on everything below it.</li>
              <li>For SSO accounts, identity-provider group mappings that can place people into Teams.</li>
            </ul>
            <p>
              Cribl shows each of these on its own screen. Answering &ldquo;<em>what can this person reach,
              and why?</em>&rdquo; means visiting the Member, every Team they belong to, the Roles, and the
              relevant Worker Groups — and working out the inheritance yourself. Comparing two people, or
              finding everyone with a certain level of access, is harder still.
            </p>

            <h3 id="what-it-is">What Access Insights is</h3>
            <p>
              Access Insights is a <strong>read-only</strong> Cribl app. It reads Members, Teams, Roles, API
              Credentials, and Worker Group / resource access-control lists through the Cribl REST API, resolves
              them the same way for every account, and presents the result in one place: a dashboard, a
              per-person access graph, a two-person comparison, and a searchable list you can export.
            </p>
            <p>
              It never changes Cribl configuration, roles, or access. The only thing it saves is your Dashboard
              card layout, in the app&rsquo;s own storage.
            </p>

            <h3 id="who-its-for">Who it&rsquo;s for</h3>
            <ul>
              <li>Organization and Workspace admins who manage Cribl access.</li>
              <li>Security and compliance reviewers running periodic access reviews.</li>
              <li>Platform leads answering &ldquo;who can change this Worker Group?&rdquo;.</li>
            </ul>
          </section>

          {/* ------------------------------------------------------------ */}
          <section id="features">
            <h2>Features at a glance</h2>
            <div className="help-table-wrap">
              <table className="help-table">
                <thead>
                  <tr>
                    <th>Feature</th>
                    <th>What it gives you</th>
                    <th>Where</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td>Dashboard</td>
                    <td>Counts of users, Teams, and admins; access per product; accounts that need review; a user list sorted by privilege.</td>
                    <td><Ui>Dashboard</Ui></td>
                  </tr>
                  <tr>
                    <td>Access graph</td>
                    <td>For one user, Team, or API key: every way access arrives, down to Worker Groups and resources.</td>
                    <td><Ui>Directory</Ui> → pick a person → <Ui>Graph</Ui></td>
                  </tr>
                  <tr>
                    <td>Details tables</td>
                    <td>The same access as tables: product levels, Teams, effective roles with their source, resource grants.</td>
                    <td><Ui>Directory</Ui> → <Ui>Details</Ui></td>
                  </tr>
                  <tr>
                    <td>Access Check</td>
                    <td>Two users side by side: what only one has, what both have, and where levels differ.</td>
                    <td><Ui>Access Check</Ui></td>
                  </tr>
                  <tr>
                    <td>Query &amp; export</td>
                    <td>Find accounts with a field builder or a JavaScript expression, and export them to CSV.</td>
                    <td><Ui>Query</Ui></td>
                  </tr>
                  <tr>
                    <td>Worker Group lookup</td>
                    <td>The reverse view: everyone who can reach a Worker Group or Fleet, and how.</td>
                    <td><Ui>Dashboard</Ui> → <Ui>Look up a Worker Group</Ui></td>
                  </tr>
                  <tr>
                    <td>SSO visibility</td>
                    <td>How each account signs in (SAML, OIDC, local) and which Teams are mapped to identity-provider groups.</td>
                    <td>User and Team pages</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </section>

          {/* ------------------------------------------------------------ */}
          <section id="use-cases">
            <h2>Common tasks</h2>

            <h3 id="uc-review">Access reviews &amp; audits</h3>
            <Steps>
              <li>Open <Ui>Dashboard</Ui> and check the <Ui>Admins</Ui> and <Ui>Needs attention</Ui> cards.</li>
              <li>Click <Ui>Export</Ui> to download every user&rsquo;s resolved access as a CSV — one row per user with their sign-in method, admin flags, level on each product, Teams, and roles.</li>
              <li>Attach the CSV to the review as evidence, or filter it first in <Ui>Query</Ui> (for example, Builder → <em>Admin is an admin (any level)</em>).</li>
            </Steps>

            <h3 id="uc-why">&ldquo;Why can (or can&rsquo;t) they…?&rdquo;</h3>
            <Steps>
              <li>In <Ui>Directory</Ui>, type the person&rsquo;s name in the search box in the top bar and press <kbd>Enter</kbd>, then switch to <Ui>Graph</Ui>.</li>
              <li>On their access graph, hover the Worker Group, product, or resource in question. The chain that grants it lights up — for example <em>Jordan Lee → Direct → Production (Editor)</em>, or <em>→ Platform team → EU Fleet (Full)</em>.</li>
              <li>If it isn&rsquo;t on the graph, they don&rsquo;t have it. Use <Ui>Access Check</Ui> against someone who does to see which Team or role makes the difference.</li>
            </Steps>

            <h3 id="uc-onboard">Onboarding &amp; role changes</h3>
            <Steps>
              <li>Open <Ui>Access Check</Ui>. Pick the new or moving person as User A and a peer in the target role as User B.</li>
              <li>Tick <Ui>Show only differences</Ui>. The <em>Only &lt;peer&gt;</em> lane is what the person is missing — usually one or two Team memberships.</li>
            </Steps>

            <h3 id="uc-offboard">Offboarding &amp; hygiene</h3>
            <Steps>
              <li>On <Ui>Dashboard</Ui>, the <Ui>Needs attention</Ui> card counts disabled users still holding roles or Team memberships, users in no Team, and Teams with no members. Click a line to open the matching list.</li>
              <li>Before removing someone, open them in <Ui>Directory</Ui>: <Ui>Details</Ui> lists every Team, role, and grant you&rsquo;ll need to revoke. For SSO users, remember that removing them from the identity provider does not remove their Cribl account.</li>
            </Steps>

            <h3 id="uc-privilege">Least privilege</h3>
            <Steps>
              <li>On <Ui>Dashboard</Ui>, each product card shows how many users can reach that product and at which level. Click a level (for example <em>Admin</em>) to list exactly those users.</li>
              <li>In <Ui>Query</Ui> (Expression mode), run <code>atLeast(&apos;stream&apos;, &apos;admin&apos;) &amp;&amp; !isOrgAdmin</code> to find product admins who aren&rsquo;t Organization admins, and review whether each still needs it.</li>
            </Steps>
          </section>

          {/* ------------------------------------------------------------ */}
          <section id="layout">
            <h2>Finding your way around</h2>
            <ul>
              <li><strong>Sidebar</strong> — <Ui>Dashboard</Ui>, <Ui>Directory</Ui>, <Ui>Access Check</Ui>, <Ui>Query</Ui>, and <Ui>Help</Ui>. <Ui>Collapse</Ui> shrinks it to icons. The line at the bottom (&ldquo;Data as of …&rdquo;) shows when the data was last loaded.</li>
              <li><strong>Search</strong> (top bar, on Directory pages) — finds any user, Team, or API key by name, email, or id. Use the arrow keys and <kbd>Enter</kbd>.</li>
              <li><strong>Refresh</strong> (top bar) — reloads everything from Cribl. The app shows a snapshot; changes made in Cribl appear after a refresh.</li>
              <li><strong>Your initials</strong> (top right) — who is signed in. To see your own access in detail, use Cribl Identity Checker.</li>
            </ul>
          </section>

          {/* ------------------------------------------------------------ */}
          <section id="dashboard">
            <h2>Dashboard</h2>
            <p>The landing page: where your organization&rsquo;s access stands right now.</p>
            <h3>What it shows</h3>
            <ul>
              <li><strong>Users</strong> — people in the organization (API keys are counted separately), the share signing in with SSO, and how many are disabled.</li>
              <li><strong>Teams</strong> — how many exist, how many are empty, and how many are mapped to identity-provider groups.</li>
              <li><strong>Admins</strong> — Organization and Workspace admins (including owners), and their share of all users.</li>
              <li><strong>Needs attention</strong> — disabled users still holding roles or Teams, users in no Team, and Teams with no members.</li>
              <li><strong>Access by product</strong> — for each Cribl product: how many users can reach it (the ring) and how those users split across levels (the bar; brighter means more access).</li>
              <li><strong>All users</strong> — owners and admins first, then by highest access. Search and filter the list; use a row&rsquo;s <Ui>⋯</Ui> to open that person&rsquo;s access graph or compare them.</li>
            </ul>
            <h3>Actions</h3>
            <ul>
              <li>Click a summary card, a finding, a product level, or a user row to open the matching list.</li>
              <li><Ui>Export</Ui> downloads every user&rsquo;s resolved access as CSV.</li>
              <li><Ui>Check access</Ui> opens Access Check.</li>
              <li>The sliders button shows or hides Dashboard cards; your choice is remembered.</li>
            </ul>
            <Note>
              There are no &ldquo;vs last week&rdquo; trends: Cribl&rsquo;s API does not keep a history of access
              changes, so every figure is the current snapshot.
            </Note>
          </section>

          {/* ------------------------------------------------------------ */}
          <section id="directory">
            <h2>Directory &amp; access graph</h2>
            <p>
              Every principal in one place. Switch between <Ui>Users</Ui>, <Ui>Teams</Ui>, and <Ui>API Keys</Ui> with
              the control at the top, then pick one from the list, or type a name in the search box in the top bar
              (it appears on Directory pages).
            </p>
            <p>
              Once one is open, the list folds into a narrow bar on the left to give the page the full width.
              Click that bar (for example <Ui>Users</Ui>) to open the list again and search it; picking someone
              closes it, as does <kbd>Esc</kbd> or clicking outside it.
            </p>
            <p>
              Each person, Team, or API key has two views, switched at the top right. <Ui>Details</Ui> opens first;
              your choice is kept as you move between people.
            </p>

            <h3>Details: the complete picture</h3>
            <ul>
              <li><strong>Product access</strong> — the effective level on each product.</li>
              <li><strong>Teams</strong> — every Team they belong to.</li>
              <li><strong>Effective roles</strong> — each role and where it comes from (Direct, via a Team, or Workspace).</li>
              <li><strong>Resource access</strong> — Worker Group, Fleet, and resource grants with their level and source, plus admin access inherited from a higher role.</li>
            </ul>
            <p>For a Team, Details also shows its identity-provider mapping and full member list.</p>

            <h3>Graph: how access is granted</h3>
            <p>
              Use <Ui>Graph</Ui> to trace <em>why</em> someone has something. The row of chips above it gives their
              level on every product at a glance.
            </p>
            <Figure
              src={directoryGraphImg}
              alt="Access graph for a user, with the path to one Worker Group highlighted"
              caption="Hovering a Worker Group highlights how the access is granted — here directly on the account."
            />
            <p>The graph reads left to right:</p>
            <Steps>
              <li><strong>The person</strong> (or Team, or API key).</li>
              <li><strong>How access arrives</strong> — <em>Direct</em> (assigned to the account), each <em>Team</em> they belong to, or a <em>Workspace</em> role.</li>
              <li><strong>What that source gives</strong> — roles, and Worker Group / Fleet grants with their level.</li>
              <li><strong>What it reaches</strong> — the product a role applies to, and resources inside a Worker Group.</li>
            </Steps>
            <p>
              Line colour shows the source (Direct, via Team, via Workspace). A dashed line is <em>inherited</em>{' '}
              admin access — for example an Organization owner is Admin on every Workspace, product, and group.
              The coloured dot on each level uses one scale throughout the app: the brighter the dot, the more
              access.
            </p>
            <ul>
              <li><strong>Hover</strong> a box to highlight the chain that grants it.</li>
              <li><strong>Click</strong> a box (or its <Ui>+N</Ui> badge) to expand or collapse what&rsquo;s under it; <Ui>Expand all</Ui> / <Ui>Collapse all</Ui> do the whole graph.</li>
              <li>The <Ui>↗</Ui> on a Team or Worker Group opens it (a Team opens in Graph view).</li>
              <li>Product chips above the graph show only one product.</li>
              <li>Zoom with the controls in the corner or your mouse wheel; drag to pan.</li>
            </ul>
            <p>A Team&rsquo;s graph lists its first 40 members; the full list is under Details.</p>
          </section>

          {/* ------------------------------------------------------------ */}
          <section id="access-check">
            <h2>Access Check</h2>
            <p>Compare two users&rsquo; access.</p>
            <Steps>
              <li>Choose <Ui>User A</Ui> and <Ui>User B</Ui>. <Ui>Swap</Ui> flips them. The page address includes both, so you can share or bookmark a comparison.</li>
              <li>Read the product table: each product&rsquo;s level for both users, with <Ui>▲ higher</Ui> on whoever has more.</li>
              <li>Read the access map below it.</li>
            </Steps>
            <Figure
              src={accessCheckImg}
              alt="Access map with one user on the left, the other on the right, and shared access in the middle"
              caption="The access map: each person’s own access next to them, shared access in the middle."
            />
            <h3>Reading the access map</h3>
            <ul>
              <li>User A is on the left and User B on the right. Between them are three lanes: <em>Only A</em>, <em>Shared</em>, and <em>Only B</em>.</li>
              <li>Items are grouped into Inherited admin reach, Teams, Roles, and Worker Groups &amp; resources. Each shows how that person gets it (<em>Direct</em>, <em>via &lt;Team&gt;</em>).</li>
              <li>An item outlined in amber is shared but at <strong>different levels</strong> — the box shows each person&rsquo;s level.</li>
              <li>The bar above the map shows the overlap: how many grants only A has, both have, and only B has.</li>
              <li>Hover a person to see everything they have, or an item to see who has it. Click a Team or Worker Group to open it.</li>
              <li><Ui>Show only differences</Ui> hides everything the two share at the same level.</li>
            </ul>
            <p><Ui>Details</Ui> keeps the side-by-side tables (identity, product access, Teams, roles, resource access).</p>
          </section>

          {/* ------------------------------------------------------------ */}
          <section id="query">
            <h2>Query</h2>
            <p>
              Find every account that matches a condition, then export the list. There are two ways to say what
              you want. Both produce the same kind of expression, which is shown so you can check it, and the
              results update as you go.
            </p>
            <div className="help-table-wrap">
              <table className="help-table">
                <thead>
                  <tr>
                    <th>Mode</th>
                    <th>Best for</th>
                    <th>How</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td>Builder</td>
                    <td>Anyone; no syntax</td>
                    <td>Pick a field (Product access, Team, Role, Admin, Sign-in method, Status, Name, Email), an operator, and a value. Add conditions and choose whether <em>all</em> or <em>any</em> must match.</td>
                  </tr>
                  <tr>
                    <td>Expression</td>
                    <td>Precise or complex queries</td>
                    <td>Write a JavaScript filter, the same kind Cribl uses in its Filter fields, with autocomplete.</td>
                  </tr>
                </tbody>
              </table>
            </div>
            <Steps>
              <li>Pick a mode at the top of the page and describe what you want.</li>
              <li>Check the <strong>Expression</strong> line: it&rsquo;s exactly what runs. <Ui>Edit as expression</Ui> opens it in Expression mode to fine-tune.</li>
              <li>Tick <Ui>Include API Credentials</Ui> to include API keys.</li>
              <li>Click <Ui>Export CSV</Ui> to download the matching accounts.</li>
            </Steps>

            <h3>Expression mode</h3>
            <p>
              Results update as you type; <Ui>Run now</Ui> or <kbd>⌘/Ctrl</kbd>+<kbd>Enter</kbd> runs immediately.
              Autocomplete suggests field and function names, methods after a <code>.</code>, and (inside quotes)
              your real Team names, role names, products, and levels.
            </p>
            <h3>What you can use</h3>
            <div className="help-table-wrap">
              <table className="help-table">
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Type</th>
                    <th>Meaning</th>
                  </tr>
                </thead>
                <tbody>
                  <tr><td><code>name</code>, <code>email</code>, <code>username</code></td><td>text</td><td>The account&rsquo;s identity.</td></tr>
                  <tr><td><code>disabled</code></td><td>true / false</td><td>The account is disabled.</td></tr>
                  <tr><td><code>authKind</code></td><td>text</td><td><code>&apos;saml&apos;</code>, <code>&apos;sso&apos;</code>, <code>&apos;local&apos;</code>, or <code>&apos;credential&apos;</code>.</td></tr>
                  <tr><td><code>isOrgAdmin</code>, <code>isWorkspaceAdmin</code>, <code>isAnyAdmin</code></td><td>true / false</td><td>Organization admin; Workspace admin; admin at any level including a single product.</td></tr>
                  <tr><td><code>teams</code>, <code>roles</code></td><td>lists</td><td>Team names and role titles (<code>teamIds</code>, <code>roleIds</code> hold the ids).</td></tr>
                  <tr><td><code>stream</code>, <code>edge</code>, <code>search</code>, <code>lake</code>, <code>outpost</code>, <code>workspaceLevel</code></td><td>text</td><td>The effective level, e.g. <code>&apos;Admin&apos;</code> or <code>&apos;No Access&apos;</code>.</td></tr>
                  <tr><td><code>hasTeam(&apos;Name&apos;)</code>, <code>hasRole(&apos;Name&apos;)</code></td><td>function</td><td>Member of that Team / holds that role (by name or id).</td></tr>
                  <tr><td><code>access(&apos;stream&apos;)</code></td><td>function</td><td>The level on that product.</td></tr>
                  <tr><td><code>atLeast(&apos;stream&apos;, &apos;editor&apos;)</code></td><td>function</td><td>Has that level or higher on that product.</td></tr>
                </tbody>
              </table>
            </div>
            <h3>Examples</h3>
            <ul className="help-examples">
              <li><code>isOrgAdmin</code> — Organization admins and owners.</li>
              <li><code>hasTeam(&apos;Platform&apos;) &amp;&amp; atLeast(&apos;stream&apos;, &apos;user&apos;)</code> — on the Platform Team and able to use Stream.</li>
              <li><code>disabled &amp;&amp; roles.length &gt; 0</code> — disabled accounts that still hold roles.</li>
              <li><code>authKind === &apos;local&apos; &amp;&amp; isAnyAdmin</code> — admins who don&rsquo;t sign in with SSO.</li>
              <li><code>name.startsWith(&apos;ali&apos;)</code> — names starting with &ldquo;ali&rdquo;.</li>
            </ul>
            <Note>
              <code>.includes()</code>, <code>.startsWith()</code>, <code>.endsWith()</code>, and <code>.indexOf()</code>{' '}
              ignore upper/lower case. <code>===</code> compares exactly. The expression runs only in your browser,
              against data the app has already loaded.
            </Note>
          </section>

          {/* ------------------------------------------------------------ */}
          <section id="worker-groups">
            <h2>Worker Group lookup</h2>
            <p>The reverse question: who can reach a particular Worker Group, Fleet, or Outpost Group?</p>
            <Steps>
              <li>Open it from <Ui>Dashboard</Ui> → <Ui>Look up a Worker Group</Ui>, from the <Ui>↗</Ui> on a Worker Group in any access graph, or by clicking a group name in a Details table.</li>
              <li>Pick a group from the list.</li>
            </Steps>
            <ul>
              <li><strong>Implicit admin access</strong> — users who are Admin on the group because they are an Organization, Workspace, or product admin, with no grant on the group itself.</li>
              <li><strong>Explicit access</strong> — users with a grant on the group, directly or through a Team, and their level.</li>
              <li><strong>Teams with access</strong> — Teams granted access to the group, and how many members each has.</li>
            </ul>
          </section>

          {/* ------------------------------------------------------------ */}
          <section id="concepts">
            <h2>Concepts</h2>

            <h3 id="model">Cribl&rsquo;s permission model</h3>
            <p>Access is layered, and higher layers pass their access down:</p>
            <pre className="help-tree">{`Organization          Owner · Admin · IAM Admin · Billing Reader · Member · User
  └ Workspace          Admin · Editor · User · Read Only
      └ Product        Stream · Edge · Search · Lake · Outpost
          └ Worker Group / Fleet
              └ Resource   pipelines, datasets, dashboards, …`}</pre>
            <p>
              An Owner or Admin at the Organization or Workspace layer is Admin on everything below it. A
              product admin (for example Stream Admin) is Admin on every Worker Group of that product. IAM Admin
              and Billing Reader do not pass access down.
            </p>

            <h3 id="sources">How access is granted</h3>
            <div className="help-table-wrap">
              <table className="help-table">
                <thead>
                  <tr><th>Source</th><th>Meaning</th></tr>
                </thead>
                <tbody>
                  <tr><td>Direct</td><td>Assigned to the account itself.</td></tr>
                  <tr><td>via &lt;Team&gt;</td><td>Inherited because the account belongs to that Team. Removing them from the Team removes it.</td></tr>
                  <tr><td>Workspace</td><td>Granted by a Workspace-scoped role (Cribl.Cloud).</td></tr>
                  <tr><td>Inherited (dashed in graphs)</td><td>Implied by an admin role higher up — not a separate grant.</td></tr>
                </tbody>
              </table>
            </div>
            <p>
              A Team can be mapped to identity-provider groups (its <em>Mapping IDs</em>). For SSO accounts,
              identity-provider group membership overrides permissions set manually on a Member or Team. Team
              pages show the mapping, and user pages show the account&rsquo;s sign-in method and identity-provider groups
              when Cribl reports them.
            </p>

            <h3 id="levels">Access levels</h3>
            <div className="help-table-wrap">
              <table className="help-table">
                <thead>
                  <tr><th>Layer</th><th>Levels (most to least)</th></tr>
                </thead>
                <tbody>
                  <tr><td>Organization</td><td>Owner · Admin · IAM Admin · Billing Reader · Member · User · No Access</td></tr>
                  <tr><td>Workspace / product</td><td>Admin · Editor · User · Read Only · No Access</td></tr>
                  <tr><td>Worker Group / Fleet</td><td>Admin · Editor · Collect · User · Read Only · No Access</td></tr>
                  <tr><td>Resource</td><td>Maintainer · Read Only · No Access</td></tr>
                </tbody>
              </table>
            </div>
            <p>Owner is Admin plus the ability to delete the object.</p>
          </section>

          {/* ------------------------------------------------------------ */}
          <section id="data">
            <h2>Data, permissions &amp; limitations</h2>
            <h3>What the app reads</h3>
            <p>
              Only <code>GET</code> requests to these Cribl API paths, declared in the app&rsquo;s policy file so an
              administrator can see them at install time:
            </p>
            <ul className="help-apis">
              <li><code>/system/teams</code>, <code>/system/teams/:id/users</code>, <code>/system/teams/:id/acl</code></li>
              <li><code>/system/roles</code>, <code>/system/credentials</code></li>
              <li><code>/products/&lt;product&gt;/users</code> and <code>/products/&lt;product&gt;/users/:id/acl</code> for Stream, Edge, Search, Lake, and Outpost</li>
              <li><code>/products/&lt;product&gt;/groups</code>, <code>…/groups/:id/acl</code>, and <code>…/groups/:id/acl/teams</code> for Stream, Edge, and Outpost</li>
            </ul>
            <p>
              The app also stores your Dashboard card layout in its own key-value store. It sends no data outside
              Cribl and declares no external domains.
            </p>
            <h3>Limitations</h3>
            <ul>
              <li><strong>Snapshot, not live.</strong> Data is loaded when the app opens and when you click Refresh. Per-person and per-group access lists are cached until the next refresh.</li>
              <li><strong>No sign-in history.</strong> Cribl&rsquo;s API does not expose last-login or last-active times, and keeps no history of access changes, so the app cannot show either.</li>
              <li><strong>Member list.</strong> Cribl.Cloud has no single &ldquo;list all members&rdquo; API, so the list is built from each product&rsquo;s member list. A member with no product access of their own may not appear; a Team page says so when it can&rsquo;t match someone.</li>
              <li><strong>Levels come from role names.</strong> Product levels are worked out from Cribl&rsquo;s role ids (for example <code>stream_editor</code> → Editor). Custom roles that don&rsquo;t follow that pattern are listed by name without a level.</li>
              <li><strong>Sign-in method.</strong> SAML / SSO / local is shown only when Cribl returns it; otherwise the Dashboard says &ldquo;Sign-in method unknown&rdquo;.</li>
              <li><strong>Mixed Read and Editor grants.</strong> When one group is granted Read from one source and Editor from another, the Details tables may show Read. The access graph and access map show each source&rsquo;s own level correctly.</li>
            </ul>
          </section>

          {/* ------------------------------------------------------------ */}
          <section id="faq">
            <h2>FAQ &amp; troubleshooting</h2>
            <dl className="help-faq">
              <dt>How does this work with Cribl Identity Checker?</dt>
              <dd>
                <p>
                  They look at the same access from two angles. <strong>Identity Checker</strong> is for any user
                  checking <em>their own</em> access: roles, Teams, and exact API-level permissions (&ldquo;what can I
                  do?&rdquo;). <strong>Access Insights</strong> is for admins and reviewers looking across the
                  organization: where each person&rsquo;s access comes from, how two people differ, and who can reach
                  a Worker Group (&ldquo;who can do what, and why?&rdquo;).
                </p>
                <p>
                  Together, for an &ldquo;I can&rsquo;t do X&rdquo; request: the person checks the object in Identity
                  Checker; an admin opens them in <Ui>Directory</Ui> to see which Team or role grants it (or that none
                  does), then uses <Ui>Access Check</Ui> against a colleague who has it to find what to add.
                </p>
                <p>
                  Share Access Insights with admins and reviewers: anyone it&rsquo;s shared with gets the app&rsquo;s
                  read permissions and can see <em>everyone&rsquo;s</em> access. Identity Checker is the right view for
                  everyone else.
                </p>
              </dd>
              <dt>A Team shows fewer members than Cribl does.</dt>
              <dd>
                Open the Team&rsquo;s <Ui>Details</Ui>. If it says the member list may be incomplete, Cribl
                didn&rsquo;t return the Team&rsquo;s member list to this app. People listed as &ldquo;can&rsquo;t match
                to an account&rdquo; usually have no product access of their own yet.
              </dd>
              <dt>The Dashboard says &ldquo;Sign-in method unknown&rdquo;.</dt>
              <dd>Cribl didn&rsquo;t return sign-in details for any account, so the SAML / SSO / local split can&rsquo;t be shown.</dd>
              <dt>A change I made in Cribl isn&rsquo;t showing.</dt>
              <dd>Click <Ui>Refresh</Ui> in the top bar. The time at the bottom of the sidebar shows when data was last loaded.</dd>
              <dt>Someone has access I can&rsquo;t explain.</dt>
              <dd>Open their access graph and hover the item. If the line is dashed, it comes from an admin role higher up (Organization, Workspace, or product admin).</dd>
            </dl>
          </section>

          {/* ------------------------------------------------------------ */}
          <section id="support">
            <h2>Support</h2>
            <p>Contact Discovered Intelligence.</p>
            <p>
              For questions about Access Insights for Cribl, contact{' '}
              <a href="mailto:support@discoveredintelligence.ca">support@discoveredintelligence.ca</a>.
            </p>
            <p className="help-back">
              <Link to="/dashboard">Back to the Dashboard</Link>
            </p>
          </section>
        </article>
      </div>
    </div>
  );
}
