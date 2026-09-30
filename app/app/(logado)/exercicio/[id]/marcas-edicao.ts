// Marca no editor as linhas novas ou modificadas em relação ao código recebido
// (S3-05, protótipo ExercicioPrecheck: "MODIFICADA").

import { RangeSetBuilder, type Extension } from "@codemirror/state";
import { Decoration, EditorView, WidgetType, type DecorationSet } from "@codemirror/view";

import { linhasMarcadas } from "@/lib/linhas-alteradas";

class Rotulo extends WidgetType {
  eq() { return true; }
  toDOM() {
    const s = document.createElement("span");
    s.className = "cm-rotulo-modificada";
    s.textContent = "MODIFICADA";
    s.setAttribute("aria-hidden", "true");
    return s;
  }
}

const tema = EditorView.baseTheme({
  ".cm-linha-modificada": { backgroundColor: "rgba(232,162,58,0.08)", boxShadow: "inset 3px 0 0 var(--color-destaque)" },
  ".cm-rotulo-modificada": {
    float: "right", color: "var(--color-destaque)", fontSize: "12px", fontWeight: "600",
    letterSpacing: "0.05em", fontFamily: "var(--font-geist-sans)",
  },
});

export function marcasDeEdicao(original: string): Extension {
  const decoracoes = EditorView.decorations.compute(["doc"], (estado): DecorationSet => {
    const b = new RangeSetBuilder<Decoration>();
    for (const n of linhasMarcadas(original, estado.doc.toString())) {
      if (n > estado.doc.lines) continue;
      const linha = estado.doc.line(n);
      b.add(linha.from, linha.from, Decoration.line({ class: "cm-linha-modificada" }));
      b.add(linha.to, linha.to, Decoration.widget({ widget: new Rotulo(), side: 1 }));
    }
    return b.finish();
  });
  return [decoracoes, tema];
}
