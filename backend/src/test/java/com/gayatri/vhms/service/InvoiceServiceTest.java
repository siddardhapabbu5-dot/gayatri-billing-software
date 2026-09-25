package com.gayatri.vhms.service;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

import org.junit.jupiter.api.Test;

class InvoiceServiceTest {

  @Test
  void normalizeTypeDefaultsToTaxInvoice() {
    assertEquals("Tax invoice", InvoiceService.normalizeType(null));
    assertEquals("Tax invoice", InvoiceService.normalizeType("  "));
  }

  @Test
  void normalizeTypeRecognizesKnownLabels() {
    assertEquals("Advance receipt", InvoiceService.normalizeType("advance receipt"));
    assertEquals("Final invoice", InvoiceService.normalizeType("Final Invoice"));
    assertEquals("Quotation", InvoiceService.normalizeType("quotation"));
  }

  @Test
  void normalizeTypeKeepsCustomLabels() {
    assertEquals("Custom slip", InvoiceService.normalizeType("Custom slip"));
  }
}
