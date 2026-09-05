# Shopee Listing Generator

Automatize a parte chata de cadastrar produtos em marketplaces: gere título, descrição, categoria e tags de busca otimizados para Shopee em segundos, a partir de uma lista simples de produtos — sem gastar nada, usando a API gratuita do Gemini.

## O problema

Cadastrar produtos manualmente em marketplaces como a Shopee é repetitivo e lento: escrever título otimizado pra busca, descrição de venda, escolher categoria certa... produto por produto. Pra lojas com dezenas ou centenas de itens, isso consome horas que poderiam ir pra outras partes do negócio.

## O que essa ferramenta faz

A partir de uma lista de produtos em JSON (nome, marca, volume, função, preço), o script gera automaticamente, para cada um:

- **Título** otimizado para busca (até 60 caracteres)
- **Descrição** de venda, destacando benefícios e modo de uso
- **Categoria sugerida** dentro da árvore de categorias da Shopee
- **Tags de busca** relevantes

O resultado sai em um `.csv` pronto pra ser usado no recurso oficial de **Cadastro em Massa** da Central do Vendedor Shopee — sem precisar de bot, scraping ou qualquer automação que viole os termos de uso da plataforma.

## Como funciona

```
produtos.json  ──▶  gerar-listagens.js  ──▶  shopee-produtos.csv
                     (chama a API do
                      Gemini pra cada
                      produto)
```

1. Você descreve seus produtos em um arquivo JSON simples
2. O script chama a API do Gemini (tier gratuito) pra gerar o conteúdo de cada anúncio
3. O resultado é exportado em CSV, pronto pra colar no modelo de upload em massa da Shopee

## Setup

Requisitos: Node.js 18+ (usa `fetch` nativo, sem dependências externas).

1. Pegue uma chave de API **gratuita** do Gemini em [aistudio.google.com/apikey](https://aistudio.google.com/apikey) (login com conta Google, sem cartão de crédito)
2. Clone o repositório:
   ```bash
   git clone https://github.com/seu-usuario/shopee-listing-generator.git
   cd shopee-listing-generator
   ```
3. Configure sua chave:
   ```bash
   export GEMINI_API_KEY="sua-chave-aqui"
   ```

## Uso

```bash
node gerar-listagens.js produtos-exemplo.json
```

Isso gera `shopee-produtos.csv` na mesma pasta, com uma linha por produto.

### Formato de entrada esperado

```json
{
  "nome_limpo": "Nome do Produto",
  "marca": "Marca X",
  "volume": "500ml",
  "funcao_confirmada": true,
  "funcao": "Descrição curta e verdadeira da função do produto",
  "estoque": 10,
  "preco_venda": 39.90
}
```

O campo `funcao_confirmada: false` sinaliza pro script gerar um aviso de revisão manual em vez de inventar uma descrição técnica não confirmada — importante pra não publicar informação errada sobre o produto.

### Formato de saída

| nome_original | titulo_shopee | descricao_shopee | categoria_sugerida | tags_busca | preco_venda | estoque | precisa_revisar |
|---|---|---|---|---|---|---|---|

## Sobre o custo

100% gratuito. O modelo usado (`gemini-2.5-flash`) tem cota diária generosa no tier gratuito do Google AI Studio. Sem cartão cadastrado, ultrapassar a cota apenas bloqueia novas chamadas temporariamente (erro 429) — nunca gera cobrança.

## Limitações conhecidas

- Não faz upload automático na Shopee (por design — automação de submissão viola os Termos de Uso da plataforma). A saída é pensada pro fluxo oficial de Cadastro em Massa.
- Não busca ou baixa fotos de produtos automaticamente.
- Descrições geradas por IA devem sempre ser revisadas antes da publicação, especialmente specs técnicas.

## Stack

Node.js · Gemini API (Google AI Studio)

## Licença

MIT — veja [LICENSE](LICENSE).