#!/bin/bash
curl -sSL -m 30 -A 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1' -o "probe/pages/${1}" -D "probe/pages/${1}.h" -w "%{http_code} %{size_download} ${2}\n" "${2}"
