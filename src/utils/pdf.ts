export function generatePdf(content: HTMLElement, filename: string): void {
  import('jspdf').then(({ jsPDF }) => {
    import('html2canvas').then(({ default: html2canvas }) => {
      html2canvas(content, { scale: 2, useCORS: true }).then(canvas => {
        const imgData = canvas.toDataURL('image/png')
        const pdf = new jsPDF('p', 'mm', 'a4')
        const pdfWidth = pdf.internal.pageSize.getWidth()
        const pdfHeight = (canvas.height * pdfWidth) / canvas.width
        pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight)
        pdf.save(filename)
      })
    })
  })
}
