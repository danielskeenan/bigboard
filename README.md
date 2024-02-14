# The Big Board

# Quick Start
1. Create a file called `url.txt` with the contents `http://localhost:8080`
2. Run `update_and_start.sh`. Setup the calendars with the gear icon.
3. Copy the resulting URL and replace the existing contents of `url.txt` with this new URL.
4. Running `update_and_start.sh` will open Firefox with the url contained in `url.txt`.

# Setup

Use Docker with the included `compose.yaml` and `compose.prod.yaml` files. Navigate to http://localhost:8080 to view the
calendar.

## Site Parameters

- `id` and `ics`: Use these in pairs to set the displayed calendars. `id` will become the label for events from the
  matching `ics`.

- `monthOffset`: Offset the display month by this number, e.g. If the current month is November, setting `monthOffset`
  to 1 would display December.
