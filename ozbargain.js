// Netlify Function (CommonJS) - fetch OzBargain competition listings and return JSON

exports.handler = async function (event) {
  try {
    const params = event.queryStringParameters || {};
    const limit = Math.max(1, Math.min(100, Number(params.limit || 50)));

    // OzBargain competition listing pages:
    // - /competition (main)
    // - /competition/all (all competitions)
    const url = "https://www.ozbargain.com.au/competition/all";

    const res = await fetch(url, {
      headers: {
        "accept": "text/html",
        "user-agent": "CompetitionKit/1.0"
      }
    });

    if (!res.ok) {
      return {
        statusCode: 502,
        headers: { "content-type": "application/json; charset=utf-8" },
        body: JSON.stringify({ ok: false, error: `Upstream returned ${res.status}` })
      };
    }

    const html = await res.text();

    // Best-effort parsing: find competition node links and titles
    // <h2> <a href="/node/12345">Title</a> </h2>
    const items = [];
    const re = /<h2[^>]*>\s*<a[^>]*href="([^"]*\/node\/(\d+)[^"]*)"[^>]*>(.*?)<\/a>\s*<\/h2>/gims;

    let m;
    while ((m = re.exec(html)) && items.length < limit) {
      const nodePath = m[1];
      const nodeId = m[2];
      const rawTitle = (m[3] || "")
        .replace(/<[^>]+>/g, "")
        .replace(/\s+/g, " ")
        .trim();

      const nodeUrl = nodePath.startsWith("http")
        ? nodePath
        : `https://www.ozbargain.com.au${nodePath}`;

      // Try to find a likely source domain nearby (best effort)
      const snippetStart = Math.max(0, m.index - 900);
      const snippetEnd = Math.min(html.length, m.index + 1500);
      const snippet = html.slice(snippetStart, snippetEnd);
      const domainMatch = snippet.match(/https?:\/\/([^"\/\s]+)\/?/i);
      const sourceDomain = domainMatch ? domainMatch[1] : "";

      items.push({
        nodeId,
        title: rawTitle,
        nodeUrl,
        entryUrl: nodeUrl,   // app opens OzBargain post; you click through to entry from there
        sourceDomain
      });
    }

    return {
      statusCode: 200,
      headers: {
        "content-type": "application/json; charset=utf-8",
        "cache-control": "no-store"
      },
      body: JSON.stringify({ ok: true, items })
    };
  } catch (e) {
    return {
      statusCode: 500,
      headers: { "content-type": "application/json; charset=utf-8" },
      body: JSON.stringify({ ok: false, error: e?.message || "Unknown error" })
    };
  }
};