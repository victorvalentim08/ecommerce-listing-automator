// calculadora.js

function calcularPrecoVendaShopee(custoBase, margemDesejada = 0.20) {
  let precoFinal;
  
  // Faixa 1: Até R$ 79,99 (Comissão 20% + Tarifa R$ 4,00)
  precoFinal = (custoBase + 4.00) / (1 - 0.20 - margemDesejada);
  if (precoFinal <= 79.99) return precoFinal.toFixed(2);
  
  // Faixa 2: R$ 80,00 a R$ 99,99 (Comissão 14% + Tarifa R$ 16,00)
  precoFinal = (custoBase + 16.00) / (1 - 0.14 - margemDesejada);
  if (precoFinal >= 80.00 && precoFinal <= 99.99) return precoFinal.toFixed(2);
  
  // Faixa 3: R$ 100,00 a R$ 199,99 (Comissão 14% + Tarifa R$ 20,00)
  precoFinal = (custoBase + 20.00) / (1 - 0.14 - margemDesejada);
  if (precoFinal >= 100.00 && precoFinal <= 199.99) return precoFinal.toFixed(2);
  
  // Faixa 4: Acima de R$ 200,00 (Comissão 14% + Tarifa R$ 26,00)
  precoFinal = (custoBase + 26.00) / (1 - 0.14 - margemDesejada);
  return precoFinal.toFixed(2);
}

// Exporta a função para ser usada em outros arquivos
module.exports = { calcularPrecoVendaShopee };