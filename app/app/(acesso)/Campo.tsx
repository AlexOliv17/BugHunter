// Campo de formulário das telas de acesso, com mensagem de erro ligada por aria-describedby.

export function Campo(props: {
  id: string; rotulo: string; tipo: string; autocomplete: string; valor?: string; erro?: string; dica?: string;
}) {
  return (
    <div className="flex flex-col gap-2">
      <label htmlFor={props.id} className="text-sm font-medium text-texto-secundario">{props.rotulo}</label>
      <input
        id={props.id} name={props.id} type={props.tipo} autoComplete={props.autocomplete}
        defaultValue={props.valor} aria-invalid={props.erro ? true : undefined}
        aria-describedby={props.erro ? `${props.id}-erro` : props.dica ? `${props.id}-dica` : undefined}
        className="h-12 rounded border border-borda bg-campo px-4 text-texto outline-none transition-colors focus:border-destaque aria-invalid:border-perigo"
      />
      {props.erro
        ? <p id={`${props.id}-erro`} className="text-sm text-perigo">{props.erro}</p>
        : props.dica && <p id={`${props.id}-dica`} className="text-sm text-texto-apagado">{props.dica}</p>}
    </div>
  );
}
