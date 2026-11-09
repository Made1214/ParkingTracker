"use client";

import { useState } from "react";
import { ActionForm } from "@/shared/ui/action-form";
import { Input } from "@/shared/ui/input";
import { updateEvent, cancelEvent, publishEvent } from "../api/actions";
import { updateEventCover } from "../api/cover-actions";

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
    status: "draft" | "published" | "cancelled" | "finished";
    cover_public_id: string | null;
  };
}) {
  const [title, setTitle] = useState(event.title);
  const [location, setLocation] = useState(event.location ?? "");
  const [description, setDescription] = useState(event.description ?? "");
  const [start, setStart] = useState(() => panamaDate(event.starts_at));
  const [end, setEnd] = useState(() => panamaDate(event.ends_at));
  return (
    <div className="card form-stack">
      <details>
        <summary>Portada del evento</summary>
        <p className="small muted">
          Solo los miembros del grupo pueden ver la imagen.
        </p>
        <ActionForm action={updateEventCover} label="Guardar portada">
          <input type="hidden" name="event_id" value={event.id} />
          <input type="hidden" name="group_id" value={event.group_id} />
          <label>
            Imagen de portada
            <Input
              type="file"
              name="cover"
              accept="image/jpeg,image/png,image/webp"
              required
            />
          </label>
          <p className="small muted">JPG, PNG o WebP. Máximo 5 MB.</p>
        </ActionForm>
        {event.cover_public_id && (
          <ActionForm action={updateEventCover} label="Eliminar portada">
            <input type="hidden" name="event_id" value={event.id} />
            <input type="hidden" name="group_id" value={event.group_id} />
            <input type="hidden" name="remove" value="true" />
          </ActionForm>
        )}
      </details>
      {event.status === "draft" && (
        <ActionForm action={publishEvent} label="Publicar evento">
          <input type="hidden" name="event_id" value={event.id} />
          <input type="hidden" name="group_id" value={event.group_id} />
        </ActionForm>
      )}
      <details>
        <summary>Editar evento</summary>
        <ActionForm action={updateEvent} label="Guardar cambios">
          <input type="hidden" name="event_id" value={event.id} />
          <input type="hidden" name="group_id" value={event.group_id} />
          <label>
            Título
            <Input
              name="title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
              maxLength={120}
            />
          </label>
          <label>
            Lugar
            <Input
              name="location"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
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
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              maxLength={5000}
            />
          </label>
        </ActionForm>
      </details>
      {event.status === "published" && (
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
      )}
    </div>
  );
}
