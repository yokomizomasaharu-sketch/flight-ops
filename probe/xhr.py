import asyncio, json, sys
from playwright.async_api import async_playwright

TARGETS = json.loads(sys.argv[1])
OUT = sys.argv[2]

async def run():
    res = {}
    async with async_playwright() as p:
        b = await p.chromium.launch(args=["--no-sandbox"])
        ctx = await b.new_context(user_agent="Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1")
        for name, url in TARGETS.items():
            page = await ctx.new_page()
            hits = []
            async def on_resp(r, hits=hits):
                try:
                    ct = r.headers.get("content-type","")
                    if ("json" in ct) or r.url.endswith(".json"):
                        body = await r.body()
                        hits.append({"url": r.url, "status": r.status, "ct": ct, "len": len(body),
                                     "cors": r.headers.get("access-control-allow-origin"),
                                     "snippet": body[:300].decode("utf-8","replace")})
                except Exception as e:
                    pass
            page.on("response", on_resp)
            try:
                await page.goto(url, wait_until="domcontentloaded", timeout=45000)
                await page.wait_for_timeout(9000)
                title = await page.title()
            except Exception as e:
                title = "ERR: "+str(e)[:150]
            res[name] = {"url": url, "title": title, "json": hits}
            await page.close()
        await b.close()
    open(OUT,"w").write(json.dumps(res, ensure_ascii=False, indent=1))
asyncio.run(run())
