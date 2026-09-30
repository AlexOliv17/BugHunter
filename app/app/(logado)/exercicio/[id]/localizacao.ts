// Extensão do CodeMirror para a etapa de localização (S3-03, RF-07): destaca a linha
// sob o cursor, mostra "Apontar esta linha" e avisa qual linha foi clicada.

import { RangeSetBuilder, StateEffect, StateField, type Extension } from "@codemirror/state";
import { Decoration, EditorView, WidgetType, type DecorationSet } from "@codemirror/view";

const definirHover = StateEffect.define<number | null>();

const linhaSobCursor = StateField.define<number | null>({
  create: () => null,
  update(valor, tr) {
    for (const e of tr.effects) if (e.is(definirHover)) return e.value;
    return valor;
  },
});

class BotaoApontar extends WidgetType {
  eq() { return true; }
  toDOM() {
    const b = document.createElement("span");
    b.className = "cm-apontar";
    b.textContent = "APONTAR ESTA LINHA";
    b.setAttribute("aria-hidden", "true");
    return b;
  }
}

const tema = EditorView.baseTheme({
  ".cm-content": { cursor: "pointer" },
  ".cm-linha-apontavel": { backgroundColor: "rgba(232,162,58,0.10)" },
  ".cm-linha-errada": { backgroundColor: "rgba(239,107,95,0.10)", textDecoration: "line-through rgba(239,107,95,0.5)" },
  ".cm-apontar": {
    float: "right", border: "1px solid var(--color-destaque)", color: "var(--color-destaque)",
    padding: "0 10px", fontSize: "12px", fontWeight: "600", letterSpacing: "0.05em", fontFamily: "var(--font-geist-sans)",
  },
});

export function modoLocalizacao(opcoes: { aoApontar: (linha: number) => void; linhasErradas: number[]; ativo: boolean }): Extension {
  if (!opcoes.ativo) return [];
  const erradas = new Set(opcoes.linhasErradas);

  const decoracoes = EditorView.decorations.compute([linhaSobCursor], (estado): DecorationSet => {
    const b = new RangeSetBuilder<Decoration>();
    const hover = estado.field(linhaSobCursor);
    for (let n = 1; n <= estado.doc.lines; n++) {
      const linha = estado.doc.line(n);
      if (erradas.has(n)) b.add(linha.from, linha.from, Decoration.line({ class: "cm-linha-errada" }));
      else if (n === hover) {
        b.add(linha.from, linha.from, Decoration.line({ class: "cm-linha-apontavel" }));
        b.add(linha.to, linha.to, Decoration.widget({ widget: new BotaoApontar(), side: 1 }));
      }
    }
    return b.finish();
  });

  const linhaDoEvento = (view: EditorView, e: MouseEvent) => {
    const pos = view.posAtCoords({ x: e.clientX, y: e.clientY }, false);
    return view.state.doc.lineAt(pos).number;
  };

  return [
    linhaSobCursor,
    decoracoes,
    tema,
    EditorView.domEventHandlers({
      mousemove(e, view) {
        const n = linhaDoEvento(view, e);
        if (view.state.field(linhaSobCursor) !== n) view.dispatch({ effects: definirHover.of(erradas.has(n) ? null : n) });
      },
      mouseleave(_e, view) {
        view.dispatch({ effects: definirHover.of(null) });
      },
      mousedown(e, view) {
        const n = linhaDoEvento(view, e);
        if (!erradas.has(n)) opcoes.aoApontar(n);
        return true;
      },
    }),
  ];
}
