"use client";

// Editor do exercício: CodeMirror 6 com numeração de linha, realce de Python e modo
// somente leitura (S3-02, RF-06). Tema com a paleta dos protótipos.

import { defaultKeymap, history, historyKeymap, indentWithTab } from "@codemirror/commands";
import { python } from "@codemirror/lang-python";
import { HighlightStyle, indentUnit, syntaxHighlighting } from "@codemirror/language";
import { Compartment, EditorState, type Extension } from "@codemirror/state";
import { EditorView, highlightActiveLine, keymap, lineNumbers } from "@codemirror/view";
import { tags as t } from "@lezer/highlight";
import { useEffect, useRef } from "react";

const tema = EditorView.theme(
  {
    "&": { backgroundColor: "var(--color-painel)", color: "var(--color-texto)", fontSize: "15px" },
    ".cm-content": { fontFamily: "var(--font-geist-mono), monospace", padding: "16px 0", caretColor: "var(--color-destaque)" },
    ".cm-line": { padding: "0 24px 0 8px", lineHeight: "2.1" },
    ".cm-gutters": { backgroundColor: "var(--color-painel)", color: "var(--color-texto-apagado)", border: "none", paddingLeft: "12px" },
    ".cm-activeLine": { backgroundColor: "rgba(255,255,255,0.03)" },
    ".cm-activeLineGutter": { backgroundColor: "transparent", color: "var(--color-texto-secundario)" },
    "&.cm-focused": { outline: "none" },
    ".cm-selectionBackground, &.cm-focused .cm-selectionBackground": { backgroundColor: "rgba(232,162,58,0.25) !important" },
  },
  { dark: true },
);

const realce = HighlightStyle.define([
  { tag: [t.keyword, t.controlKeyword, t.definitionKeyword], color: "#c792ea" },
  { tag: [t.function(t.variableName), t.function(t.definition(t.variableName))], color: "#82aaff" },
  { tag: [t.string], color: "#c3e88d" },
  { tag: [t.number, t.bool, t.null], color: "#f78c6c" },
  { tag: [t.comment], color: "#6b6b66", fontStyle: "italic" },
  { tag: [t.operator], color: "#89ddff" },
]);

const modoLeitura = (somenteLeitura: boolean): Extension => [
  EditorState.readOnly.of(somenteLeitura),
  EditorView.editable.of(!somenteLeitura),
];

type Props = {
  codigo: string;
  somenteLeitura: boolean;
  aoMudar?: (texto: string) => void;
  extensoes?: Extension;      // comportamentos extras, como a localização (S3-03)
  rotulo?: string;
};

export function EditorCodigo({ codigo, somenteLeitura, aoMudar, extensoes = [], rotulo = "Código do exercício" }: Props) {
  const hospedeiro = useRef<HTMLDivElement>(null);
  const vista = useRef<EditorView | null>(null);
  const leitura = useRef(new Compartment());
  const extras = useRef(new Compartment());
  const aoMudarAtual = useRef(aoMudar);
  aoMudarAtual.current = aoMudar;

  useEffect(() => {
    if (!hospedeiro.current) return;
    const v = new EditorView({
      parent: hospedeiro.current,
      state: EditorState.create({
        doc: codigo,
        extensions: [
          lineNumbers(),
          highlightActiveLine(),
          history(),
          keymap.of([...defaultKeymap, ...historyKeymap, indentWithTab]),
          indentUnit.of("    "),
          python(),
          syntaxHighlighting(realce),
          tema,
          EditorView.contentAttributes.of({ "aria-label": rotulo }),
          leitura.current.of(modoLeitura(somenteLeitura)),
          extras.current.of(extensoes),
          EditorView.updateListener.of((u) => {
            if (u.docChanged) aoMudarAtual.current?.(u.state.doc.toString());
          }),
        ],
      }),
    });
    vista.current = v;
    return () => {
      v.destroy();
      vista.current = null;
    };
    // o documento é criado uma vez; mudanças de modo passam pelos compartimentos
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    vista.current?.dispatch({ effects: leitura.current.reconfigure(modoLeitura(somenteLeitura)) });
  }, [somenteLeitura]);

  useEffect(() => {
    vista.current?.dispatch({ effects: extras.current.reconfigure(extensoes) });
  }, [extensoes]);

  return <div ref={hospedeiro} />;
}
