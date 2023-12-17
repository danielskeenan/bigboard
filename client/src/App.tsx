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
import {Alert, Button, Spinner} from "react-bootstrap";
import {zip} from "lodash";
import {createPortal} from "react-dom";
import ConfigureDialog from "./ConfigureDialog.tsx";
import {CheckLg, Gear} from "react-bootstrap-icons";

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
    const icsFiles = zip(urlParams.getAll('id'), urlParams.getAll('ics'), urlParams.getAll('color')) as string[][];
    const sources: EventSourceInput = [];
    for (const [id, ics, color] of icsFiles) {
      // Build the URL to request calendar events from.
      const url = new URL(SERVER_BASE_URL);
      const urlParams = new URLSearchParams({
        source: ics,
      });
      url.search = urlParams.toString();

      sources.push({
        id: id,
        url: url.toString(),
        format: 'json',
        backgroundColor: color,
      });
    }

    return sources;
  }, []);

  const [isLoading, setIsLoading] = useState(false);
  /** Keyed by event source url */
  const [errorMessages, setErrorMessages] = useState<SourceErrors>(new Map(eventSources.map(source => [source.url as string, null])));
  const [configureVisible, setConfigureVisible] = useState(false);
  const showConfigure = useCallback(() => setConfigureVisible(true), [setConfigureVisible]);
  const refetchEvents = useCallback(() => {
    if (!isLoading) {
      const calendarApi = calendarRef.current?.getApi();
      calendarApi?.refetchEvents();
    }
  }, [isLoading, calendarRef]);

  // Auto-refresh timer.
  useEffect(() => {
    const timerId = setInterval(refetchEvents, refreshInterval);

    return () => {
      clearInterval(timerId);
    };
  }, [refetchEvents, refreshInterval]);

  // Reload page at 12:01 am daily. The calendar library does strange things when it is kept visible across day boundaries.
  useEffect(() => {
    const now = new Date();
    const reloadAt = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 0, 1, 0, 0);
    const timeUntilReload = reloadAt.getTime() - now.getTime();
    const timerId = setTimeout(() => location.reload(), timeUntilReload);

    return () => {
      clearTimeout(timerId);
    };
  }, []);

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
    return new Date(now.getFullYear(), now.getMonth() + monthOffset);
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

  // Configure dialog cancel callback.
  const onConfigureCancel = useCallback(() => {
    setConfigureVisible(false);
  }, [setConfigureVisible]);

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
      <div className="footer">
        {errorMessageCount === 0 && (
          <>
            <Button variant="secondary" onClick={showConfigure}><Gear title="Settings"/></Button>
            <Button variant="outline-success" disabled={calendarRef === null || isLoading} onClick={refetchEvents}>
              {isLoading && <Spinner as="span" animation="border" role="status" size="sm" title="Loading"/>}
              {!isLoading && <CheckLg title="Up to date" role="status"/>}
            </Button>
          </>
        )}
        {errorMessageCount > 0 && (
          <Alert variant="danger"><ErrorList calender={calendarRef.current?.getApi()} errors={errorMessages}/></Alert>
        )}
      </div>
      {createPortal(
        <ConfigureDialog
          visible={configureVisible}
          eventSources={eventSources}
          onCancel={onConfigureCancel}
        />, document.body)}
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
