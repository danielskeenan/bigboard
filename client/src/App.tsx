import {MutableRefObject, useCallback, useEffect, useMemo, useRef, useState} from 'react';
import FullCalendar from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/daygrid';
import bootstrap5Plugin from '@fullcalendar/bootstrap5';
import './App.scss';
import {
  CalendarApi,
  EventContentArg,
  EventInput,
  EventSourceInput,
  JsonRequestError,
  ToolbarInput,
} from "@fullcalendar/core";
import crc32 from 'crc/crc32';
import convert from 'color-convert';
import {Alert} from "react-bootstrap";
import {zipObject} from "lodash";

const SERVER_BASE_URL = new URL(`http://${(new URL(document.URL)).hostname}:8000/parse`);

/** url: error message */
interface SourceErrors extends Map<string, string | null> {
}

export default function App() {
  const calendarRef: MutableRefObject<FullCalendar | null> = useRef(null);
  /** How many ms between refreshes */
  const refreshInterval = 60000;

  // Load sources and calculate their properties.
  const eventSources: EventSourceInput = useMemo(() => {
    const urlParams = (new URL(document.URL)).searchParams;
    const icsFiles: Record<string, string> = zipObject(urlParams.getAll('id'), urlParams.getAll('ics'));
    const sources: EventSourceInput = [];
    for (const [id, ics] of Object.entries(icsFiles)) {
      // Build the URL to request calendar events from.
      const url = new URL(SERVER_BASE_URL);
      const urlParams = new URLSearchParams({
        source: ics,
      });
      url.search = urlParams.toString();

      // Hash the ID to determine background color. Borrowed from sACNView's algorithm.
      const goldenRatio = 0.618033988749895;
      const idHash = crc32(id);
      const hue = (goldenRatio * idHash) % 1.0;
      const sat = ((goldenRatio * idHash * 2) % 0.25) + 0.75;
      const light = 0.5;
      const color = convert.hsl.hex([hue * 100, sat * 100, light * 100]);

      sources.push({
        id: id,
        url: url.toString(),
        format: 'json',
        backgroundColor: `#${color}`,
      });

      // Initialize the source errors.
    }

    return sources;
  }, []);

  const [isLoading, setIsLoading] = useState(false);
  /** Keyed by event source url */
  const [errorMessages, setErrorMessages] = useState<SourceErrors>(new Map(eventSources.map(source => [source.url as string, null])));

  // Auto-refresh timer.
  useEffect(() => {
    const timerId = setInterval(() => {
      if (!isLoading) {
        const calendarApi = calendarRef.current?.getApi();
        calendarApi?.refetchEvents();
      }
    }, refreshInterval);

    return () => {
      clearInterval(timerId);
    };
  }, [isLoading, refreshInterval]);

  // Configure top bar to display only the month name in the center.
  const headerToolbar: ToolbarInput = {
    start: '',
    center: 'title',
    end: '',
  };

  // Calculate the initial date for the calendar using the monthOffset query param.
  const startDate = useMemo(() => {
    // Get the number of months to offset the display.
    const url = new URL(document.URL);
    let monthOffset = parseInt(url.searchParams.get('monthOffset') ?? '0');
    if (isNaN(monthOffset)) {
      monthOffset = 0;
    }

    // Calculate the first day of the first week of the desired month.
    const now = new Date();
    const firstOfMonth = new Date(now.getFullYear(), now.getMonth() + monthOffset);

    return firstOfMonth;
  }, []);

  // Custom event display: Show calendar source id (i.e. user's initials), event time, event title.
  // Also provide classes to enable correct styling.
  const eventContent = useCallback((eventArgs: EventContentArg) => {
    const styles = {
      '--fc-user-color': eventArgs.backgroundColor,
    };

    // .fc-event-flexcontainer is a kludge to get custom styling with CSS variables inside .fc-event.
    return (
      <div className="fc-event-flexcontainer" style={styles}>
        <div className="fc-event-details">
          <div className="fc-event-id">{eventArgs.event.source?.id}</div>
          <div className="fc-event-time">{eventArgs.timeText}</div>
        </div>
        <div className="fc-event-title">{eventArgs.event.title}</div>
      </div>
    );
  }, []);

  // Error handler. Show the user an error.
  const errorHandler = useCallback((error: JsonRequestError) => {
    const responseUrl = normalizeResponseUrl(error.response.url);
    // Find the calendar id to qualify the error message.
    const calendarId = calendarRef.current?.getApi().getEventSources().find(source => {
      return source.url === responseUrl;
    })?.id;

    errorMessages.set(responseUrl, `${calendarId ?? "Unknown Source"}: ${error.message}`);
    setErrorMessages(errorMessages);
  }, [calendarRef, errorMessages, setErrorMessages]);

  // Success handler clears the current error message when events fetched successfully.
  const successHandler = useCallback((_: EventInput[], response?: Response) => {
    if (response !== undefined) {
      const responseUrl = normalizeResponseUrl(response.url);
      if (errorMessages.get(responseUrl) !== null) {
        errorMessages.set(responseUrl, null);
        setErrorMessages(errorMessages);
      }
    }
  }, [errorMessages, setErrorMessages]);

  const errorMessageCount = useMemo(() => {
    let count = 0;
    for (const message of errorMessages.values()) {
      if (message !== null) {
        ++count;
      }
    }
    return count;
  }, [errorMessages]);

  return (
    <div className="App">
      <FullCalendar
        ref={calendarRef}
        plugins={[dayGridPlugin, bootstrap5Plugin]}
        initialDate={startDate}
        initialView="dayGridMonth"
        headerToolbar={headerToolbar}
        eventSources={eventSources}
        aspectRatio={0.6}
        eventContent={eventContent}
        loading={setIsLoading}
        eventSourceFailure={errorHandler}
        eventSourceSuccess={successHandler}
      />
      {errorMessageCount === 0 && isLoading && (
        <Alert variant="success">Loading...</Alert>
      )}
      {errorMessageCount === 0 && !isLoading && (
        <Alert variant="success">Up to date</Alert>
      )}
      {errorMessageCount > 0 && (
        <Alert variant="danger"><ErrorList calender={calendarRef.current?.getApi()} errors={errorMessages}/></Alert>
      )}
    </div>
  );
}

function ErrorList(props: { calender?: CalendarApi, errors: SourceErrors }) {
  const messages = Array.from(props.errors.values()).filter(message => message !== null);

  if (messages.length === 0) {
    return (<></>);
  } else if (messages.length === 1) {
    return (<>{messages[0]}</>);
  } else {
    return (
      <ul>
        {messages.map(message => (
          <li>{message}</li>
        ))}
      </ul>
    );
  }
}

/**
 * Remove all URL params besides `source`.
 *
 * This is necessary because fullcalendar will add assorted other parameters to the URL making it otherwise impossible
 * to lookup event sources by URL.
 *
 * @param urlString
 */
function normalizeResponseUrl(urlString: string): string {
  const url = new URL(urlString);
  let urlParams = url.searchParams;
  urlParams = new URLSearchParams({source: urlParams.get('source') as string});
  url.search = urlParams.toString();

  return url.toString();
}
