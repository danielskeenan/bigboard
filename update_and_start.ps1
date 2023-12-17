cd $PSScriptRoot
git fetch origin --recurse-submodules --progress --prune
git rebase origin/main
docker compose -f /home/dankeenan/Documents/Projects/bigboard/compose.yaml -f /home/dankeenan/Documents/Projects/bigboard/compose.prod.yaml -p bigboard up -d
