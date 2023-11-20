import {Button, Form, Modal, Table} from "react-bootstrap";
import {useCallback, useId, useMemo, useState} from "react";
import {cloneDeep, isEqual} from "lodash";
import {EventInput} from "@fullcalendar/core";
import {PlusLg, XLg} from "react-bootstrap-icons";

type ConfigureSource = Pick<EventInput, "id" | "url" | "backgroundColor">;
const defaultSource: ConfigureSource = {
  id: '',
  url: '',
  backgroundColor: '',
};

interface ConfigureDialogProps {
  visible: boolean;
  eventSources: EventInput[];
  onCancel: () => void;
}

export default function ConfigureDialog(props: ConfigureDialogProps) {
  const id = useId();
  const url = new URL(document.URL);

  // Month offset
  const [monthOffset, setMonthOffset] = useState(parseInt(url.searchParams.get('monthOffset') ?? '0'));
  const onChangeMonthOffset = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const newMonthOffset = parseInt(e.target.value);
    if (!isNaN(newMonthOffset)) {
      setMonthOffset(newMonthOffset);
    }
  }, [setMonthOffset]);
  const visibleMonth = useMemo(() => {
    const now = new Date();
    const visibleDate = new Date(now.getFullYear(), now.getMonth() + monthOffset);
    return visibleDate.toLocaleDateString(undefined, {month: 'long', year: 'numeric'});
  }, [monthOffset]);

  // Sources
  const [sources, setSources] = useState<ConfigureSource[]>(() => {
    const cloned = [];
    for (let source of props.eventSources) {
      const sourceUrl = new URL(source.url as string);

      const configureSource = {
        id: source.id as string,
        url: sourceUrl.searchParams.get('source') as string,
        backgroundColor: source.backgroundColor,
      };
      cloned.push(configureSource);
    }
    return cloned;
  });
  const updateSource = (ix: number, prop: keyof ConfigureSource, newValue: string) => {
    const newSources = cloneDeep(sources);
    newSources[ix][prop] = newValue;
    setSources(newSources);
  };
  const removeSource = (ix: number) => {
    const newSources = cloneDeep(sources);
    newSources.splice(ix, 1);
    setSources(newSources);
  };
  const addSource = () => {
    if (sources.find((source) => isEqual(source, defaultSource))) {
      // Already has a blank row, don't add another one.
      return;
    }
    const newSources = cloneDeep(sources);
    newSources.push(cloneDeep(defaultSource));
    setSources(newSources);
  };

  // Url
  const newUrl = new URL(document.URL);
  const newSearchParams = new URLSearchParams({monthOffset: monthOffset.toString()});
  for (let source of sources) {
    if (source.id == '' || source.url == '') {
      // Skip empty sources.
      continue;
    }
    newSearchParams.append('id', source.id as string);
    newSearchParams.append('ics', source.url as string);
    newSearchParams.append('color', source.backgroundColor as string);
  }
  newUrl.search = newSearchParams.toString();

  return (
    <Modal size="xl" centered show={props.visible} onHide={props.onCancel}>
      <Modal.Header closeButton>
        <Modal.Title>Configure</Modal.Title>
      </Modal.Header>

      <Modal.Body>
        <Form>
          <Form.Group className="mb-3" controlId={`${id}-monthoffset`}>
            <Form.Label>Month Offset</Form.Label>
            <Form.Control type="number" value={monthOffset} min={-12} max={12} onChange={onChangeMonthOffset}/>
            <Form.Text className="text-muted">
              {visibleMonth}
            </Form.Text>
          </Form.Group>

          <Form.Group className="mb-3">
            <Form.Label>Sources</Form.Label>
            <Table bordered>
              <thead>
              <tr>
                <th>Color</th>
                <th>ID</th>
                <th>URL</th>
                <th></th>
              </tr>
              </thead>
              <tbody>
              {sources.map((source, ix) =>
                <EventSourceRow
                  key={ix}
                  color={source.backgroundColor as string}
                  setColor={newColor => updateSource(ix, 'backgroundColor', newColor)}
                  id={source.id as string}
                  setId={newId => updateSource(ix, 'id', newId)}
                  url={source.url as string}
                  setUrl={newUrl => updateSource(ix, 'url', newUrl)}
                  onRemove={() => removeSource(ix)}
                />)}
              </tbody>
            </Table>
            <Button variant="outline-success" onClick={addSource}><PlusLg title="Add"/></Button>
          </Form.Group>
        </Form>
      </Modal.Body>

      <Modal.Footer>
        <Button variant="secondary" onClick={props.onCancel}>
          Cancel
        </Button>
        <Button variant="primary" href={newUrl.toString()}>
          Save & Reload
        </Button>
      </Modal.Footer>
    </Modal>
  );
}

interface EventSourceRowProps {
  color: string;
  setColor: (newColor: string) => void;
  id: string;
  setId: (newId: string) => void;
  url: string;
  setUrl: (newUrl: string) => void;
  onRemove: () => void;
}

function EventSourceRow(props: EventSourceRowProps) {
  const {setColor, setId, setUrl} = props;

  const id = useId();

  return (
    <tr>
      <td>
        <Form.Control id={`${id}=color`} type="color" value={props.color} onChange={e => setColor(e.target.value)}/>
      </td>
      <td>
        <Form.Control id={`${id}-id`} type="text" htmlSize={5} spellCheck={false} value={props.id}
                      onChange={e => setId(e.target.value)}/>
      </td>
      <td>
        <Form.Control id={`${id}-url`} type="url" value={props.url} onChange={e => setUrl(e.target.value)}/>
      </td>
      <td>
        <Button variant="outline-danger" onClick={props.onRemove}><XLg title="Remove"/></Button>
      </td>
    </tr>
  );
}
