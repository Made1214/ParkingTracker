"use client";

import { useState } from "react";
import { ActionForm } from "@/shared/ui/action-form";
import { Input } from "@/shared/ui/input";
import { updateEvent, cancelEvent } from "../api/actions";

function panamaDate(value: string) {
  const date = new Date(Date.parse(value) - 5 * 60 * 60 * 1000);
  return date.toISOString().slice(0, 16);
}

export function ManageEvent({
  event,
}: {
  event: {
    id: string;
    group_id: string;
    title: string;
    description: string | null;
    location: string | null;
    starts_at: string;
    ends_at: string;
  };
}) {
  const [start, setStart] = useState(() => panamaDate(event.starts_at));
  const [end, setEnd] = useState(() => panamaDate(event.ends_at));
  return (
    <div className="card form-stack">
      <details>
        <summary>Editar evento</summary>
        <ActionForm action={updateEvent} label="Guardar cambios">
          <input type="hidden" name="event_id" value={event.id} />
          <input type="hidden" name="group_id" value={event.group_id} />
          <label>
            Título
            <Input
              name="title"
              defaultValue={event.title}
              required
              maxLength={120}
            />
          </label>
          <label>
            Lugar
            <Input
              name="location"
              defaultValue={event.location ?? ""}
              maxLength={200}
            />
          </label>
          <label>
            Inicio · hora de Panamá
            <Input
              type="datetime-local"
              required
              value={start}
              onChange={(e) => setStart(e.target.value)}
            />
          </label>
          <label>
            Fin · hora de Panamá
            <Input
              type="datetime-local"
              required
              min={start}
              value={end}
              onChange={(e) => setEnd(e.target.value)}
            />
          </label>
          <input
            type="hidden"
            name="starts_at"
            value={start ? `${start}:00-05:00` : ""}
          />
          <input
            type="hidden"
            name="ends_at"
            value={end ? `${end}:00-05:00` : ""}
          />
          <label>
            Descripción
            <textarea
              className="input"
              name="description"
              defaultValue={event.description ?? ""}
              rows={3}
              maxLength={5000}
            />
          </label>
        </ActionForm>
      </details>
      <details>
        <summary>Cancelar evento</summary>
        <p className="small muted">
          El evento dejará de aceptar respuestas y aparecerá como cancelado.
        </p>
        <ActionForm action={cancelEvent} label="Confirmar cancelación">
          <input type="hidden" name="event_id" value={event.id} />
          <input type="hidden" name="group_id" value={event.group_id} />
        </ActionForm>
      </details>
    </div>
  );
}
