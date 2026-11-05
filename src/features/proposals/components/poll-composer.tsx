"use client";

import { useActionState, useId, useState } from "react";
import {
  CalendarDays,
  Check,
  CirclePlus,
  ListChecks,
  Plus,
  Trash2,
  X,
} from "lucide-react";
import { Button } from "@/shared/ui/button";
import type { ActionState } from "@/shared/lib/forms";
import { createPoll } from "../api/actions";
import styles from "./decisions.module.css";

export function PollComposer({
  groupId,
  eventId,
}: {
  groupId: string;
  eventId: string;
}) {
  const id = useId();
  const [expanded, setExpanded] = useState(false);
  const [question, setQuestion] = useState("");
  const [options, setOptions] = useState([
    { id: 0, value: "" },
    { id: 1, value: "" },
  ]);
  const [nextId, setNextId] = useState(2);
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  const [multiple, setMultiple] = useState(false);
  const [state, formAction, pending] = useActionState(
    async (previous: ActionState, data: FormData) => {
      data.set(
        "options",
        options
          .map((option) => option.value.trim())
          .filter(Boolean)
          .join("\n"),
      );
      data.set("closes_at", date && time ? date + "T" + time : "");
      const result = await createPoll(previous, data);
      if (result.success) {
        setQuestion("");
        setOptions([
          { id: 0, value: "" },
          { id: 1, value: "" },
        ]);
        setNextId(2);
        setDate("");
        setTime("");
        setMultiple(false);
        setExpanded(false);
      }
      return result;
    },
    {},
  );
  return (
    <div className={styles.createArea}>
      <button
        type="button"
        className={styles.createTrigger}
        aria-expanded={expanded}
        aria-controls={id}
        onClick={() => setExpanded(!expanded)}
        disabled={pending}
      >
        <span className={styles.triggerIcon}>
          <Plus size={19} aria-hidden="true" />
        </span>
        <span>
          <strong>Crear una votación</strong>
          <small>Haz una pregunta y deja que el grupo decida</small>
        </span>
        {expanded ? (
          <X size={18} aria-hidden="true" />
        ) : (
          <span className={styles.triggerAction}>
            Crear <span aria-hidden="true">→</span>
          </span>
        )}
      </button>
      {expanded && (
        <form
          id={id}
          action={formAction}
          className={styles.pollComposer}
          aria-busy={pending}
          onReset={(event) => event.preventDefault()}
        >
          <input type="hidden" name="group_id" value={groupId} />
          <input type="hidden" name="event_id" value={eventId} />
          <fieldset className={styles.composerFields} disabled={pending}>
            <label className={styles.field} htmlFor={id + "-question"}>
              <span>¿Qué quieren decidir?</span>
              <input
                className="input"
                id={id + "-question"}
                name="question"
                value={question}
                onChange={(event) => setQuestion(event.target.value)}
                maxLength={200}
                required
                placeholder="Por ejemplo, ¿a dónde vamos a comer?"
              />
            </label>
            <div className={styles.formGroup}>
              <div className={styles.fieldHeading}>
                <span>
                  <ListChecks size={16} aria-hidden="true" /> Opciones de
                  respuesta
                </span>
                <small>{options.length}/10</small>
              </div>
              <p className={styles.hint}>
                Agrega al menos dos opciones para elegir.
              </p>
              <div className={styles.optionInputs}>
                {options.map((option, index) => (
                  <div className={styles.optionInput} key={option.id}>
                    <span aria-hidden="true">
                      {String(index + 1).padStart(2, "0")}
                    </span>
                    <input
                      className="input"
                      aria-label={"Opción " + (index + 1)}
                      value={option.value}
                      onChange={(event) =>
                        setOptions((current) =>
                          current.map((item) =>
                            item.id === option.id
                              ? { ...item, value: event.target.value }
                              : item,
                          ),
                        )
                      }
                      maxLength={100}
                      required={index < 2}
                      placeholder={"Opción " + (index + 1)}
                    />
                    {options.length > 2 && (
                      <button
                        type="button"
                        className={styles.removeOption}
                        aria-label={"Eliminar opción " + (index + 1)}
                        onClick={() =>
                          setOptions((current) =>
                            current.filter((item) => item.id !== option.id),
                          )
                        }
                      >
                        <Trash2 size={16} aria-hidden="true" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
              {options.length < 10 && (
                <button
                  type="button"
                  className={styles.addOption}
                  onClick={() => {
                    setOptions((current) => [
                      ...current,
                      { id: nextId, value: "" },
                    ]);
                    setNextId(nextId + 1);
                  }}
                >
                  <CirclePlus size={16} aria-hidden="true" /> Agregar opción
                </button>
              )}
            </div>
            <div className={styles.formGroup}>
              <div className={styles.fieldHeading}>
                <span>
                  <CalendarDays size={16} aria-hidden="true" /> Cierre de la
                  votación
                </span>
              </div>
              <p className={styles.hint}>
                Elige cuándo dejar de recibir votos. Hora de Panamá.
              </p>
              <div className={styles.dateFields}>
                <label className={styles.field}>
                  Fecha
                  <input
                    className="input"
                    type="date"
                    required
                    value={date}
                    onChange={(event) => setDate(event.target.value)}
                  />
                </label>
                <label className={styles.field}>
                  Hora
                  <input
                    className="input"
                    type="time"
                    required
                    value={time}
                    onChange={(event) => setTime(event.target.value)}
                  />
                </label>
              </div>
            </div>
            <label className={styles.multipleChoice}>
              <span>
                <strong>Permitir varias opciones</strong>
                <small>Cada persona podrá elegir más de una respuesta.</small>
              </span>
              <input
                type="checkbox"
                name="allow_multiple"
                checked={multiple}
                onChange={(event) => setMultiple(event.target.checked)}
              />
              <span className={styles.switch} aria-hidden="true" />
            </label>
            {state.error && (
              <p className="message error" role="alert">
                {state.error}
              </p>
            )}
            <div className={styles.composerActions}>
              <button
                className={styles.cancel}
                type="button"
                onClick={() => setExpanded(false)}
              >
                Cancelar
              </button>
              <Button type="submit" disabled={pending}>
                {pending ? (
                  "Creando…"
                ) : (
                  <>
                    <Check size={16} aria-hidden="true" /> Publicar votación
                  </>
                )}
              </Button>
            </div>
          </fieldset>
        </form>
      )}
      {!expanded && state.success && (
        <p className="message success" role="status">
          {state.success}
        </p>
      )}
    </div>
  );
}
