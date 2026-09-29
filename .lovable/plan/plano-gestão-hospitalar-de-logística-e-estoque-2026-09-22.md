# Plano — Gestão hospitalar de logística e estoque

## Entrega
- Criar o painel inicial de **Locais**, com busca, indicadores operacionais e hospitais fictícios clicáveis.
- Criar a página detalhada de cada hospital, mantendo o contexto do local e os indicadores principais.
- Implementar as abas **Estoque Transitório** e **Estoque Consignado**, cada uma com sua tabela responsiva e dados fictícios.
- Implementar o fluxo visual de **Adicionar material** em uma janela de formulário com nome, quantidade e dois seletores de data.

## Direção visual
- Seguir a direção escolhida **Frosted Clinical Console**: superfícies translúcidas, azul-petróleo clínico, verde para estados positivos e âmbar para alertas.
- Priorizar leitura rápida, contraste, navegação por teclado e boa adaptação a celular e desktop.
- Usar os componentes shadcn/ui existentes para botões, abas, tabelas, janela, campos e calendário.

## Detalhes técnicos
- Manter tudo somente no front-end; novos materiais existirão apenas durante a sessão atual.
- Usar rotas tipadas para `/` e `/locais/$hospitalId`.
- Adicionar metadados próprios para cada página.
- Validar a aparência e os fluxos principais em desktop e celular.
