import { getSearchParams } from "@dub/utils";
import { isBlacklistedReferrer } from "@/lib/edge-config";
import { getLinkViaEdge } from "@/lib/planetscale";
import { getStats } from "@/lib/stats";
import { ratelimit } from "@/lib/upstash";
import { LOCALHOST_IP } from "@dub/utils";
import { ipAddress } from "@vercel/edge";
import { NextResponse, type NextRequest } from "next/server";

// TODO: switch to 'edge' after https://github.com/vercel/next.js/issues/48295 is fixed
// export const runtime = "edge";

export const GET = async (
  req: NextRequest,
  { params }: { params: Record<string, string> },
) => {
  const { endpoint } = params;
  const searchParams = getSearchParams(req.url);
  const { domain, key, interval } = searchParams;

  // demo link (dub.sh/github)
  if (domain === "dub.sh" && key === "github") {
    // Rate limit in production
    if (process.env.NODE_ENV !== "development") {
      if (await isBlacklistedReferrer(req.headers.get("referer"))) {
        return new Response("Don't DDoS me pls 🥺", { status: 429 });
      }
      const ip = ipAddress(req) || LOCALHOST_IP;
      const { success } = await ratelimit(
        15,
        endpoint === "clicks" ? "10 s" : "1 h",
      ).limit(`${ip}:${domain}:${key}:${endpoint}`);

      if (!success) {
        return new Response("Don't DDoS me pls 🥺", { status: 429 });
      }
    }
  } else {
    const data = await getLinkViaEdge(domain, key);
    // if the link is explicitly private (publicStats === false)
    // or if the link doesn't exist in database (data === undefined) and is not a dub.sh link
    // (we need to exclude dub.sh public demo links here)
    if (data?.publicStats === 0 || (domain !== "dub.sh" && !data)) {
      return new Response(`Stats for this link are not public`, {
        status: 403,
      });
    }
    // return 403 if interval is 90d or all
    if (interval === "all" || interval === "90d") {
      return new Response(`Require higher plan`, { status: 403 });
    }
  }

  const response = await getStats({
    domain,
    key,
    endpoint,
    interval,
    ...searchParams,
  });

  return NextResponse.json(response);
};
