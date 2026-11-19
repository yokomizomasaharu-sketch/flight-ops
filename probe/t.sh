#!/bin/bash
u="$1"
h=$(curl -sS -m 25 -D /tmp/h.txt -o /tmp/b.txt -w '%{http_code} %{content_type} %{size_download}' -H 'Origin: https://yokomizomasaharu-sketch.github.io' "$u" 2>/dev/null)
cors=$(grep -i '^access-control-allow-origin' /tmp/h.txt | tr -d '\r' | head -2 | paste -sd';')
echo "[$h] CORS:${cors:-none} $u"
