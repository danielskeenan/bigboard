# The Big Board

# Setup

Use Docker with the included `compose.yaml` and `compose.prod.yaml` files. Navigate to http://localhost:8080 to view the
calendar.

## Site Parameters

- `id` and `ics`: Use these in pairs to set the displayed calendars. `id` will become the label for events from the
  matching `ics`.

- `monthOffset`: Offset the display month by this number, e.g. If the current month is November, setting `monthOffset`
  to 1 would display December.
