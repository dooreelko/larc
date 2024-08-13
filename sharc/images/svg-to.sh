#!/bin/bash

set -euo pipefail

ID=$(basename "$1" | cut -d. -f1 | sed s/_32// | sed s/_64// | sed s/_/-/ | tr '[:upper:]' '[:lower:]' | sed s/arch-// | sed s/aws-//  | sed s/amazon-// )
VIEWBOX=$( xq -r '.svg["@viewBox"]' "$1")
G=$( xq -x --xml-root g '.svg.g' "$1")
# BG=$( xq -r '.svg.g.rect["@fill"]' "$1")

echo "<symbol id=\"$ID\" viewbox=\"$VIEWBOX\">
$G
</symbol>"

# echo "
#         .container-$ID {
#             border: solid 1px $BG;
#         }
# "