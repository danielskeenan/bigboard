#! /usr/bin/env bash

launched=0
launch() {
	docker compose -f compose.yaml -f compose.prod.yaml -p bigboard up --build --wait --force-recreate --detach
	launched=$?
}

SCRIPT_DIR=$( cd -- "$( dirname -- "${BASH_SOURCE[0]}" )" &> /dev/null && pwd )
cd "${SCRIPT_DIR}" || exit
git fetch origin --recurse-submodules --progress --prune
git rebase origin/main

# If docker cli used exit codes, this would continually try to launch the container. It doesn't so doesn't work.
# Keeping this here in case it works some day...
#while [ ${launched} == 0 ]; do
#    launch
#    if [ ${launched} == 0 ]; then
#        sleep 10s
#    fi
#done

launch
echo "If you get \"error during connect: this error may indicate that the docker daemon is not running\", ensure Docker \
Desktop is started."
echo "If all containers are healthy, open http://localhost:8080. Otherwise, fix errors."
echo "Press any key to close the launcher. Server will remain running in the background."
read -r -s -n 1
