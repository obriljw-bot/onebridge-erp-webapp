function include(filename) {
  return HtmlService.createHtmlOutputFromFile(filename).getContent();
}


function doGet(e) {
  var page = (e && e.parameter && e.parameter.page) ? e.parameter.page : 'orderFile';

  var template = HtmlService.createTemplateFromFile('Layout');
  template.page = page;

  return template
    .evaluate()
    .setTitle('OneBridge ERP')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}
