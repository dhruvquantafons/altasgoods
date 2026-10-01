import { BulkUpload } from "@/components/seller/catalog/bulk-upload";
import { ToastButton } from "@/components/seller/client-kit";
import { Mono } from "@/components/seller/primitives";
import { StatusBadge } from "@/components/ui/badge";
import { Card, CardHeader } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { Table, TableContainer, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { CATEGORY_TEMPLATES, UPLOAD_STATUS, uploadErrors, uploadHistory } from "@/lib/mock/seller-extra";
import { formatDateTime, formatNumber } from "@/lib/utils";

export const metadata = { title: "Bulk upload" };

export default function BulkUploadPage() {
  return (
    <>
      <PageHeader
        breadcrumbs={[{ label: "Listings", href: "/seller/catalog" }, { label: "Bulk upload" }]}
        title="Bulk upload"
        description="Create or update many listings with a category template. Download the template, fill it in, upload it, then fix any rows we flag."
      />

      <BulkUpload templates={CATEGORY_TEMPLATES} errors={uploadErrors} />

      <Card className="mt-6">
        <CardHeader title="Upload history" description="Processing reports are kept for 90 days" />
        <TableContainer className="mt-3">
          <Table className="min-w-[760px]">
            <THead>
              <TR className="hover:bg-transparent">
                <TH>File</TH>
                <TH>Template</TH>
                <TH>Uploaded</TH>
                <TH align="right">Rows</TH>
                <TH align="right">Processed</TH>
                <TH align="right">Errors</TH>
                <TH>Status</TH>
                <TH align="right">Report</TH>
              </TR>
            </THead>
            <TBody>
              {uploadHistory.map((u) => (
                <TR key={u.id}>
                  <TD>
                    <p className="text-[13px] font-medium text-ink-900">{u.file}</p>
                    <Mono className="text-xs text-ink-500">{u.id}</Mono>
                  </TD>
                  <TD className="text-[13px]">{u.template}</TD>
                  <TD className="text-[13px] text-ink-600">{formatDateTime(u.at)}</TD>
                  <TD align="right">{formatNumber(u.rows)}</TD>
                  <TD align="right">{formatNumber(u.ok)}</TD>
                  <TD align="right" className={u.errors ? "font-medium text-danger-700" : undefined}>
                    {formatNumber(u.errors)}
                  </TD>
                  <TD>
                    <StatusBadge meta={UPLOAD_STATUS[u.status]} size="sm" />
                  </TD>
                  <TD align="right">
                    {u.errors > 0 ? (
                      <ToastButton size="xs" variant="ghost" icon="download" message={`Error report for ${u.file} downloaded.`}>
                        Errors
                      </ToastButton>
                    ) : (
                      <span className="text-xs text-ink-500">No errors</span>
                    )}
                  </TD>
                </TR>
              ))}
            </TBody>
          </Table>
        </TableContainer>
      </Card>
    </>
  );
}
