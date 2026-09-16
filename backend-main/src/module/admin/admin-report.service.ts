import * as ExcelJS from 'exceljs';
import {
  BadRequestException,
  Injectable,
} from '@nestjs/common';

import { PrismaService } from '../../infrastructure/prisma/prisma.service';

export type AdminReportType =
  | 'CUSTOMERS'
  | 'ASTROLOGERS'
  | 'CONSULTATIONS'
  | 'PAYMENTS'
  | 'WALLETS'
  | 'SUBSCRIPTIONS';

export interface GenerateAdminReportInput {
  reportType: AdminReportType;
  startDate?: string;
  endDate?: string;
  format?: string;
}

interface ReportResult {
  filename: string;
  data: Buffer | string;
  contentType: string;
  totalRecords: number;
}

@Injectable()
export class AdminReportService {
  constructor(
    private readonly prisma: PrismaService,
  ) {}

  async generateReport(
    input: GenerateAdminReportInput,
  ): Promise<ReportResult> {
    const reportType = this.validateReportType(
      input.reportType,
    );

    const format =
      (input.format ?? 'XLSX').toUpperCase();

    if (!['CSV', 'XLSX'].includes(format)) {
      throw new BadRequestException(
        'Supported report formats are XLSX and CSV.',
      );
    }

    const {
      startDate,
      endDate,
      dateWhere,
    } = this.buildDateFilter(
      input.startDate,
      input.endDate,
    );

    let rows: Record<string, unknown>[] = [];

    switch (reportType) {
      case 'CUSTOMERS':
        rows = await this.customerRows(dateWhere);
        break;

      case 'ASTROLOGERS':
        rows = await this.astrologerRows(dateWhere);
        break;

      case 'CONSULTATIONS':
        rows = await this.consultationRows(dateWhere);
        break;

      case 'PAYMENTS':
        rows = await this.paymentRows(dateWhere);
        break;

      case 'WALLETS':
        rows = await this.walletRows(dateWhere);
        break;

      case 'SUBSCRIPTIONS':
        rows = await this.subscriptionRows(dateWhere);
        break;

      default:
        throw new BadRequestException(
          'Unsupported report type.',
        );
    }

    if (format === 'XLSX') {
      const workbook =
        await this.toPremiumExcel(
          reportType,
          startDate,
          endDate,
          rows,
        );

      return {
        filename: this.buildExcelFilename(
          reportType,
          startDate,
          endDate,
        ),
        data: workbook,
        contentType:
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        totalRecords: rows.length,
      };
    }

    const csv = this.toProfessionalCsv(
      reportType,
      startDate,
      endDate,
      rows,
    );

    return {
      filename: this.buildFilename(
        reportType,
        startDate,
        endDate,
      ),
      data: csv,
      contentType:
        'text/csv; charset=utf-8',
      totalRecords: rows.length,
    };
  }

  private validateReportType(
    value: string,
  ): AdminReportType {
    const allowed: AdminReportType[] = [
      'CUSTOMERS',
      'ASTROLOGERS',
      'CONSULTATIONS',
      'PAYMENTS',
      'WALLETS',
      'SUBSCRIPTIONS',
    ];

    if (!allowed.includes(value as AdminReportType)) {
      throw new BadRequestException(
        'Invalid report type.',
      );
    }

    return value as AdminReportType;
  }

  private buildDateFilter(
    start?: string,
    end?: string,
  ) {
    let startDate: Date | undefined;
    let endDate: Date | undefined;

    if (start) {
      startDate = new Date(`${start}T00:00:00.000Z`);

      if (Number.isNaN(startDate.getTime())) {
        throw new BadRequestException(
          'Invalid start date.',
        );
      }
    }

    if (end) {
      endDate = new Date(`${end}T23:59:59.999Z`);

      if (Number.isNaN(endDate.getTime())) {
        throw new BadRequestException(
          'Invalid end date.',
        );
      }
    }

    if (
      startDate &&
      endDate &&
      startDate > endDate
    ) {
      throw new BadRequestException(
        'Start date cannot be after end date.',
      );
    }

    const createdAt =
      startDate || endDate
        ? {
            ...(startDate
              ? { gte: startDate }
              : {}),
            ...(endDate
              ? { lte: endDate }
              : {}),
          }
        : undefined;

    return {
      startDate,
      endDate,
      dateWhere: createdAt
        ? { createdAt }
        : {},
    };
  }

  private async customerRows(
    dateWhere: Record<string, unknown>,
  ) {
    const prisma = this.prisma as any;

    const users = await prisma.user.findMany({
      where: {
        ...dateWhere,
        isAstrologer: false,
      },
      orderBy: {
        createdAt: 'desc',
      },
      include: {
        role: true,
        userProfile: true,
        wallet: true,
      },
    });

    return users
      .filter((user: any) => {
        const roleText = JSON.stringify(
          user.role ?? {},
        ).toUpperCase();

        return !roleText.includes('ADMIN');
      })
      .map((user: any) => ({
        customerId: user.id,
        name:
          user.name ??
          user.userProfile?.name ??
          '',
        phone: user.phone ?? '',
        email: user.email ?? '',
        gender: user.gender ?? '',
        active: user.isActive,
        blocked: user.isBlocked,
        verified: user.isVerified,
        profileComplete:
          user.isProfileComplete,
        firstChatGranted:
          user.freeChatGrantedAt ?? '',
        firstChatUsed:
          user.freeChatUsedAt ?? '',
        freeChatMinutes:
          user.freeChatMinutes ?? '',
        subscriptionStatus:
          user.subscriptionStatus ?? '',
        walletBalance:
          user.wallet?.balance ?? '',
        walletCurrency:
          user.wallet?.currency ?? '',
        lastLoginAt:
          user.lastLoginAt ?? '',
        registeredAt:
          user.createdAt,
      }));
  }

  private async astrologerRows(
    dateWhere: Record<string, unknown>,
  ) {
    const prisma = this.prisma as any;

    const items =
      await prisma.astrologer.findMany({
        where: dateWhere,
        orderBy: {
          createdAt: 'desc',
        },
        include: {
          user: {
            include: {
              userProfile: true,
            },
          },
        },
      });

    return items.map((item: any) => ({
      astrologerId: item.id,
      userId: item.userId,
      name:
        item.user?.name ??
        item.user?.userProfile?.name ??
        '',
      phone: item.user?.phone ?? '',
      email: item.user?.email ?? '',
      languages:
        Array.isArray(item.languages)
          ? item.languages.join(' | ')
          : '',
      categories:
        Array.isArray(
          item.consultationCategories,
        )
          ? item.consultationCategories.join(
              ' | ',
            )
          : '',
      experienceYears:
        item.experience ?? '',
      pricePerMinute:
        item.pricePerMin ?? '',
      rating: item.rating ?? '',
      totalReviews:
        item.totalReviews ?? 0,
      approved: item.isApproved,
      verified: item.isVerified,
      online: item.isOnline,
      createdAt: item.createdAt,
      updatedAt: item.updatedAt,
    }));
  }

  private async consultationRows(
    dateWhere: Record<string, unknown>,
  ) {
    const prisma = this.prisma as any;

    const sessions =
      await prisma.callSession.findMany({
        where: dateWhere,
        orderBy: {
          createdAt: 'desc',
        },
        include: {
          user: {
            include: {
              userProfile: true,
            },
          },
          astrologer: {
            include: {
              userProfile: true,
            },
          },
          earning: true,
          _count: {
            select: {
              messages: true,
            },
          },
        },
      });

    return sessions.map((item: any) => ({
      consultationId: item.id,
      customerId:
        item.userId ??
        item.user?.id ??
        '',
      customerName:
        item.user?.name ??
        item.user?.userProfile?.name ??
        '',
      astrologerId:
        item.astrologerId ??
        item.astrologer?.id ??
        '',
      astrologerName:
        item.astrologer?.name ??
        item.astrologer?.userProfile?.name ??
        '',
      status: item.status ?? '',
      mode:
        item.mode ??
        item.callType ??
        item.type ??
        '',
      durationSeconds:
        item.durationSeconds ??
        item.duration ??
        '',
      purchasedMinutes:
        item.purchasedMinutes ?? '',
      amount:
        item.amount ??
        item.totalAmount ??
        item.earning?.amount ??
        '',
      messageCount:
        item._count?.messages ?? 0,
      startedAt:
        item.startedAt ?? '',
      endedAt:
        item.endedAt ?? '',
      createdAt: item.createdAt,
      updatedAt:
        item.updatedAt ?? '',
    }));
  }

  private async paymentRows(
    dateWhere: Record<string, unknown>,
  ) {
    const prisma = this.prisma as any;

    const payments =
      await prisma.paymentOrder.findMany({
        where: dateWhere,
        orderBy: {
          createdAt: 'desc',
        },
        include: {
          user: {
            include: {
              userProfile: true,
            },
          },
          wallet: true,
          kundliOrder: true,
        },
      });

    return payments.map((item: any) => ({
      paymentId: item.id,
      customerId:
        item.userId ??
        item.user?.id ??
        '',
      customerName:
        item.user?.name ??
        item.user?.userProfile?.name ??
        '',
      phone: item.user?.phone ?? '',
      email: item.user?.email ?? '',
      amount: item.amount ?? '',
      currency:
        item.currency ??
        item.wallet?.currency ??
        '',
      status: item.status ?? '',
      provider:
        item.provider ??
        item.gateway ??
        'Razorpay',
      razorpayOrderId:
        item.razorpayOrderId ?? '',
      razorpayPaymentId:
        item.razorpayPaymentId ?? '',
      refundedAmount:
        item.refundedAmount ?? '',
      refundId:
        item.refundId ??
        item.razorpayRefundId ??
        '',
      kundliOrderId:
        item.kundliOrder?.id ?? '',
      createdAt: item.createdAt,
      updatedAt:
        item.updatedAt ?? '',
    }));
  }

  private async walletRows(
    dateWhere: Record<string, unknown>,
  ) {
    const prisma = this.prisma as any;

    const wallets =
      await prisma.wallet.findMany({
        where: dateWhere,
        orderBy: {
          createdAt: 'desc',
        },
        include: {
          user: {
            include: {
              userProfile: true,
            },
          },
          _count: {
            select: {
              ledgerEntries: true,
              paymentOrders: true,
            },
          },
        },
      });

    return wallets.map((item: any) => ({
      walletId: item.id,
      customerId: item.userId,
      customerName:
        item.user?.name ??
        item.user?.userProfile?.name ??
        '',
      phone: item.user?.phone ?? '',
      email: item.user?.email ?? '',
      balance: item.balance,
      paidBalance: item.paidBalance,
      freeBalance: item.freeBalance,
      lockedBalance:
        item.lockedBalance,
      currency: item.currency,
      ledgerEntries:
        item._count?.ledgerEntries ?? 0,
      paymentOrders:
        item._count?.paymentOrders ?? 0,
      createdAt: item.createdAt,
      updatedAt: item.updatedAt,
    }));
  }

  private async subscriptionRows(
    dateWhere: Record<string, unknown>,
  ) {
    const prisma = this.prisma as any;

    const subscriptions =
      await prisma.subscription.findMany({
        where: dateWhere,
        orderBy: {
          createdAt: 'desc',
        },
        include: {
          user: true,
          subscriptionPlan: true,
        },
      });

    return subscriptions.map(
      (item: any) => ({
        subscriptionId: item.id,
        customerId: item.userId,
        customerName:
          item.user?.name ?? '',
        phone: item.user?.phone ?? '',
        email: item.user?.email ?? '',
        planId:
          item.subscriptionPlanId ?? '',
        planName:
          item.subscriptionPlan?.name ??
          item.subscriptionPlan?.title ??
          '',
        status:
          item.subscriptionStatus ?? '',
        amount: item.amount ?? '',
        currency: item.currency ?? '',
        trial: item.isTrial,
        razorpaySubscriptionId:
          item.razorpaySubscriptionId ?? '',
        razorpayPaymentId:
          item.razorpayPaymentId ?? '',
        razorpayOrderId:
          item.razorpayOrderId ?? '',
        startDate:
          item.startDate ?? '',
        endDate: item.endDate ?? '',
        nextBillingAt:
          item.nextBillingAt ?? '',
        cancelledAt:
          item.cancelledAt ?? '',
        expiredAt:
          item.expiredAt ?? '',
        createdAt: item.createdAt,
        updatedAt: item.updatedAt,
      }),
    );
  }

  private async toPremiumExcel(
    reportType: AdminReportType,
    startDate: Date | undefined,
    endDate: Date | undefined,
    rows: Record<string, unknown>[],
  ): Promise<Buffer> {
    const workbook = new ExcelJS.Workbook();

    workbook.creator = 'Astro Soul Path';
    workbook.company = 'Astro Soul Path';
    workbook.subject =
      `${this.reportDisplayTitle(reportType)} - Administrative Report`;
    workbook.title =
      `Astro Soul Path - ${this.reportDisplayTitle(reportType)}`;
    workbook.created = new Date();
    workbook.modified = new Date();

    const sheet = workbook.addWorksheet(
      this.reportDisplayTitle(reportType),
      {
        views: [
          {
            state: 'frozen',
            ySplit: 10,
          },
        ],
        pageSetup: {
          orientation: 'landscape',
          fitToPage: true,
          fitToWidth: 1,
          fitToHeight: 0,
          paperSize: 9,
          margins: {
            left: 0.25,
            right: 0.25,
            top: 0.4,
            bottom: 0.4,
            header: 0.2,
            footer: 0.2,
          },
        },
      },
    );

    const NAVY = '0B2341';
    const NAVY_2 = '102E52';
    const GOLD = 'D6A62E';
    const GOLD_LIGHT = 'F5E4AE';
    const CREAM = 'FFF9EC';
    const CREAM_2 = 'FBF3DF';
    const WHITE = 'FFFFFF';
    const TEXT = '10233F';
    const MUTED = '677489';
    const BORDER = 'D6DCE5';
    const GREEN = '14833B';
    const RED = 'C62828';
    const BLUE = 'DDEEFF';

    const headers =
      this.reportHeaders(reportType);

    const tableColumns =
      Math.max(headers.length, 16);

    const lastColumn =
      this.columnLetter(tableColumns);

    const actualLastColumn =
      this.columnLetter(headers.length);

    // ========================================================
    // BRAND HEADER
    // ========================================================

    sheet.mergeCells(`A1:${lastColumn}2`);

    const brand = sheet.getCell('A1');

    brand.value = {
      richText: [
        {
          text: '✦  ',
          font: {
            name: 'Georgia',
            size: 22,
            color: {
              argb: GOLD,
            },
            bold: true,
          },
        },
        {
          text: 'ASTRO SOUL PATH',
          font: {
            name: 'Georgia',
            size: 26,
            color: {
              argb: 'F4D28A',
            },
            bold: true,
          },
        },
        {
          text:
            '\nGUIDANCE  •  BALANCE  •  A BRIGHTER YOU',
          font: {
            name: 'Aptos',
            size: 10,
            color: {
              argb: WHITE,
            },
          },
        },
      ],
    };

    brand.alignment = {
      vertical: 'middle',
      horizontal: 'left',
      wrapText: true,
      indent: 1,
    };

    brand.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: {
        argb: NAVY,
      },
    };

    sheet.getRow(1).height = 34;
    sheet.getRow(2).height = 28;


    // ========================================================
    // REPORT TITLE
    // ========================================================

    sheet.mergeCells(`A3:${lastColumn}3`);

    const titleCell = sheet.getCell('A3');

    titleCell.value =
      `${this.reportDisplayTitle(reportType)}  |  ${this.reportDescription(reportType)}`;

    titleCell.font = {
      name: 'Georgia',
      size: 17,
      bold: true,
      color: {
        argb: TEXT,
      },
    };

    titleCell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: {
        argb: CREAM,
      },
    };

    titleCell.alignment = {
      vertical: 'middle',
      horizontal: 'left',
      indent: 1,
    };

    sheet.getRow(3).height = 34;


    // ========================================================
    // PREMIUM KPI CARDS
    // ========================================================

    const generatedAt =
      new Date();

    const periodText =
      `${startDate
        ? this.excelDate(startDate)
        : 'Beginning'
      }  →  ${
        endDate
          ? this.excelDate(endDate)
          : 'Current'
      }`;

    const cards = [
      {
        label: 'TOTAL RECORDS',
        value: String(rows.length),
      },
      {
        label: 'REPORT PERIOD',
        value: periodText,
      },
      {
        label: 'GENERATED AT',
        value: this.excelDateTime(
          generatedAt,
        ),
      },
      {
        label: 'REPORT TYPE',
        value:
          this.reportDisplayTitle(
            reportType,
          ),
      },
    ];

    const quarter =
      Math.floor(tableColumns / 4);

    for (
      let index = 0;
      index < 4;
      index++
    ) {
      const startCol =
        index * quarter + 1;

      const endCol =
        index === 3
          ? tableColumns
          : startCol +
            quarter -
            1;

      sheet.mergeCells(
        5,
        startCol,
        6,
        endCol,
      );

      const cell =
        sheet.getCell(5, startCol);

      cell.value = {
        richText: [
          {
            text:
              `${cards[index].label}\n`,
            font: {
              name: 'Aptos',
              size: 9,
              bold: true,
              color: {
                argb: '876615',
              },
            },
          },
          {
            text:
              cards[index].value,
            font: {
              name: 'Georgia',
              size:
                index === 0
                  ? 18
                  : 11,
              bold: true,
              color: {
                argb: TEXT,
              },
            },
          },
        ],
      };

      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: {
          argb:
            index % 2 === 0
              ? CREAM
              : CREAM_2,
        },
      };

      cell.alignment = {
        vertical: 'middle',
        horizontal: 'left',
        wrapText: true,
        indent: 1,
      };

      cell.border = {
        top: {
          style: 'thin',
          color: {
            argb: GOLD,
          },
        },
        bottom: {
          style: 'thin',
          color: {
            argb: GOLD,
          },
        },
        left: {
          style: 'thin',
          color: {
            argb: BORDER,
          },
        },
        right: {
          style: 'thin',
          color: {
            argb: BORDER,
          },
        },
      };
    }

    sheet.getRow(5).height = 29;
    sheet.getRow(6).height = 25;


    // ========================================================
    // SECTION BAR
    // ========================================================

    sheet.mergeCells(
      `A8:${lastColumn}8`,
    );

    const section =
      sheet.getCell('A8');

    section.value =
      `✦  ${this.reportDisplayTitle(
        reportType,
      )} Details`;

    section.font = {
      name: 'Georgia',
      size: 13,
      bold: true,
      color: {
        argb: WHITE,
      },
    };

    section.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: {
        argb: NAVY_2,
      },
    };

    section.alignment = {
      vertical: 'middle',
      horizontal: 'left',
      indent: 1,
    };

    sheet.getRow(8).height = 28;


    // ========================================================
    // TABLE HEADER
    // ========================================================

    const headerRow = 10;

    headers.forEach(
      (key, index) => {
        const cell =
          sheet.getCell(
            headerRow,
            index + 1,
          );

        cell.value =
          this.prettyHeader(key);

        cell.font = {
          name: 'Aptos',
          size: 9,
          bold: true,
          color: {
            argb: TEXT,
          },
        };

        cell.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: {
            argb: GOLD_LIGHT,
          },
        };

        cell.alignment = {
          vertical: 'middle',
          horizontal: 'center',
          wrapText: true,
        };

        cell.border = {
          top: {
            style: 'thin',
            color: {
              argb: GOLD,
            },
          },
          bottom: {
            style: 'thin',
            color: {
              argb: GOLD,
            },
          },
          left: {
            style: 'thin',
            color: {
              argb: WHITE,
            },
          },
          right: {
            style: 'thin',
            color: {
              argb: WHITE,
            },
          },
        };
      },
    );

    sheet.getRow(headerRow).height = 38;


    // ========================================================
    // TABLE DATA
    // ========================================================

    let dataEndRow =
      headerRow;

    if (rows.length === 0) {

      sheet.mergeCells(
        headerRow + 1,
        1,
        headerRow + 2,
        headers.length,
      );

      const noData =
        sheet.getCell(
          headerRow + 1,
          1,
        );

      noData.value =
        'No records found for the selected report period.';

      noData.font = {
        name: 'Georgia',
        size: 12,
        italic: true,
        color: {
          argb: MUTED,
        },
      };

      noData.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: {
          argb: CREAM,
        },
      };

      noData.alignment = {
        vertical: 'middle',
        horizontal: 'center',
      };

      dataEndRow =
        headerRow + 2;
    }
    else {

      rows.forEach(
        (record, rowIndex) => {
          const excelRow =
            headerRow +
            rowIndex +
            1;

          headers.forEach(
            (key, columnIndex) => {
              const cell =
                sheet.getCell(
                  excelRow,
                  columnIndex + 1,
                );

              const value =
                this.excelCellValue(
                  record[key],
                );

              cell.value =
                value as any;

              cell.font = {
                name: 'Aptos',
                size: 9,
                color: {
                  argb: TEXT,
                },
              };

              cell.alignment = {
                vertical: 'middle',
                horizontal:
                  this.isNumericColumn(
                    key,
                  )
                    ? 'right'
                    : 'left',
                wrapText: true,
              };

              cell.fill = {
                type: 'pattern',
                pattern: 'solid',
                fgColor: {
                  argb:
                    rowIndex % 2 === 0
                      ? WHITE
                      : 'F8FAFC',
                },
              };

              cell.border = {
                bottom: {
                  style: 'hair',
                  color: {
                    argb: BORDER,
                  },
                },
                left: {
                  style: 'hair',
                  color: {
                    argb: BORDER,
                  },
                },
                right: {
                  style: 'hair',
                  color: {
                    argb: BORDER,
                  },
                },
              };

              if (
                typeof value ===
                  'number' &&
                this.isMoneyColumn(key)
              ) {
                cell.numFmt =
                  '#,##0.00';
              }

              const text =
                String(value)
                  .toUpperCase();

              if (
                [
                  'YES',
                  'ACTIVE',
                  'SUCCESS',
                  'APPROVED',
                  'VERIFIED',
                  'ONLINE',
                  'COMPLETED',
                  'PAID',
                ].includes(text)
              ) {
                cell.font = {
                  ...cell.font,
                  bold: true,
                  color: {
                    argb: GREEN,
                  },
                };
              }

              if (
                [
                  'NO',
                  'FAILED',
                  'REJECTED',
                  'BLOCKED',
                  'CANCELLED',
                  'REFUNDED',
                  'EXPIRED',
                ].includes(text)
              ) {
                cell.font = {
                  ...cell.font,
                  bold: true,
                  color: {
                    argb: RED,
                  },
                };
              }

              if (
                key ===
                  'subscriptionStatus' &&
                text === 'FREE'
              ) {
                cell.fill = {
                  type: 'pattern',
                  pattern: 'solid',
                  fgColor: {
                    argb: BLUE,
                  },
                };

                cell.font = {
                  ...cell.font,
                  bold: true,
                };
              }
            },
          );

          sheet.getRow(
            excelRow,
          ).height = 29;

          dataEndRow =
            excelRow;
        },
      );
    }


    // ========================================================
    // AUTOFILTER
    // ========================================================

    sheet.autoFilter = {
      from: {
        row: headerRow,
        column: 1,
      },
      to: {
        row: headerRow,
        column:
          headers.length,
      },
    };


    // ========================================================
    // COLUMN WIDTHS
    // ========================================================

    headers.forEach(
      (key, index) => {
        let width = 16;

        const lower =
          key.toLowerCase();

        if (
          lower.includes('id')
        ) {
          width = 24;
        }

        if (
          lower.includes('email')
        ) {
          width = 28;
        }

        if (
          lower.includes('name')
        ) {
          width = 20;
        }

        if (
          lower.includes('date') ||
          lower.includes('at')
        ) {
          width = 22;
        }

        if (
          lower.includes('status')
        ) {
          width = 18;
        }

        if (
          lower.includes(
            'categories',
          ) ||
          lower.includes(
            'languages',
          )
        ) {
          width = 24;
        }

        sheet.getColumn(
          index + 1,
        ).width = width;
      },
    );


    // ========================================================
    // TOTAL RECORDS BAND
    // ========================================================

    const totalRow =
      dataEndRow + 2;

    sheet.mergeCells(
      totalRow,
      1,
      totalRow,
      tableColumns,
    );

    const totalCell =
      sheet.getCell(
        totalRow,
        1,
      );

    totalCell.value =
      `▣  TOTAL RECORDS: ${rows.length}`;

    totalCell.font = {
      name: 'Georgia',
      size: 12,
      bold: true,
      color: {
        argb: TEXT,
      },
    };

    totalCell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: {
        argb: CREAM_2,
      },
    };

    totalCell.alignment = {
      vertical: 'middle',
      horizontal: 'left',
      indent: 1,
    };

    totalCell.border = {
      top: {
        style: 'thin',
        color: {
          argb: GOLD,
        },
      },
      bottom: {
        style: 'thin',
        color: {
          argb: GOLD,
        },
      },
    };

    sheet.getRow(
      totalRow,
    ).height = 28;


    // ========================================================
    // PREMIUM FOOTER / QUOTE
    // ========================================================

    const quoteRow =
      totalRow + 3;

    sheet.mergeCells(
      quoteRow,
      1,
      quoteRow + 2,
      tableColumns,
    );

    const quote =
      sheet.getCell(
        quoteRow,
        1,
      );

    quote.value =
      '“Every Soul Has a Path. We Help You Find Yours.”\n\nThank you for being part of Astro Soul Path';

    quote.font = {
      name: 'Georgia',
      size: 13,
      italic: true,
      color: {
        argb: TEXT,
      },
    };

    quote.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: {
        argb: CREAM,
      },
    };

    quote.alignment = {
      vertical: 'middle',
      horizontal: 'center',
      wrapText: true,
    };

    quote.border = {
      top: {
        style: 'thin',
        color: {
          argb: GOLD,
        },
      },
      bottom: {
        style: 'thin',
        color: {
          argb: GOLD,
        },
      },
    };


    // ========================================================
    // BOTTOM BRAND BAR
    // ========================================================

    const footerRow =
      quoteRow + 4;

    sheet.mergeCells(
      footerRow,
      1,
      footerRow + 1,
      tableColumns,
    );

    const footer =
      sheet.getCell(
        footerRow,
        1,
      );

    footer.value =
      '✦  ASTRO SOUL PATH    •    AUTHENTIC GUIDANCE    •    TRUSTED ASTROLOGERS    •    SECURE & PRIVATE    •    A BRIGHTER TOMORROW';

    footer.font = {
      name: 'Georgia',
      size: 9,
      bold: true,
      color: {
        argb: 'F4D28A',
      },
    };

    footer.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: {
        argb: NAVY,
      },
    };

    footer.alignment = {
      vertical: 'middle',
      horizontal: 'center',
      wrapText: true,
    };

    sheet.getRow(
      footerRow,
    ).height = 24;

    sheet.getRow(
      footerRow + 1,
    ).height = 20;


    // ========================================================
    // PRINT HEADER / FOOTER
    // ========================================================

    sheet.headerFooter.oddFooter =
      '&LAstro Soul Path&CConfidential Administrative Report&RPage &P of &N';

    sheet.properties.defaultRowHeight =
      20;


    sheet.pageSetup.printArea =
      `A1:${lastColumn}${footerRow + 1}`;

    const result =
      await workbook.xlsx.writeBuffer();

    return Buffer.from(result);
  }


  private reportHeaders(
    type: AdminReportType,
  ): string[] {
    const map: Record<
      AdminReportType,
      string[]
    > = {
      CUSTOMERS: [
        'customerId',
        'name',
        'phone',
        'email',
        'gender',
        'active',
        'blocked',
        'verified',
        'profileComplete',
        'firstChatGranted',
        'firstChatUsed',
        'freeChatMinutes',
        'subscriptionStatus',
        'walletBalance',
        'walletCurrency',
        'lastLoginAt',
        'registeredAt',
      ],

      ASTROLOGERS: [
        'astrologerId',
        'userId',
        'name',
        'phone',
        'email',
        'languages',
        'categories',
        'experienceYears',
        'pricePerMinute',
        'rating',
        'totalReviews',
        'approved',
        'verified',
        'online',
        'createdAt',
        'updatedAt',
      ],

      CONSULTATIONS: [
        'consultationId',
        'customerId',
        'customerName',
        'astrologerId',
        'astrologerName',
        'status',
        'mode',
        'durationSeconds',
        'purchasedMinutes',
        'amount',
        'messageCount',
        'startedAt',
        'endedAt',
        'createdAt',
        'updatedAt',
      ],

      PAYMENTS: [
        'paymentId',
        'customerId',
        'customerName',
        'phone',
        'email',
        'amount',
        'currency',
        'status',
        'provider',
        'razorpayOrderId',
        'razorpayPaymentId',
        'refundedAmount',
        'refundId',
        'kundliOrderId',
        'createdAt',
        'updatedAt',
      ],

      WALLETS: [
        'walletId',
        'customerId',
        'customerName',
        'phone',
        'email',
        'balance',
        'paidBalance',
        'freeBalance',
        'lockedBalance',
        'currency',
        'ledgerEntries',
        'paymentOrders',
        'createdAt',
        'updatedAt',
      ],

      SUBSCRIPTIONS: [
        'subscriptionId',
        'customerId',
        'customerName',
        'phone',
        'email',
        'planId',
        'planName',
        'status',
        'amount',
        'currency',
        'trial',
        'razorpaySubscriptionId',
        'razorpayPaymentId',
        'razorpayOrderId',
        'startDate',
        'endDate',
        'nextBillingAt',
        'cancelledAt',
        'expiredAt',
        'createdAt',
        'updatedAt',
      ],
    };

    return map[type];
  }


  private reportDisplayTitle(
    type: AdminReportType,
  ): string {
    const map: Record<
      AdminReportType,
      string
    > = {
      CUSTOMERS: 'Customer Report',
      ASTROLOGERS:
        'Astrologer Report',
      CONSULTATIONS:
        'Consultation Report',
      PAYMENTS:
        'Payment Report',
      WALLETS:
        'Wallet Report',
      SUBSCRIPTIONS:
        'Subscription Report',
    };

    return map[type];
  }


  private reportDescription(
    type: AdminReportType,
  ): string {
    const map: Record<
      AdminReportType,
      string
    > = {
      CUSTOMERS:
        'Registered customers, account activity and wallet summary.',
      ASTROLOGERS:
        'Approval, verification, ratings and astrologer performance.',
      CONSULTATIONS:
        'Customer consultations, sessions, duration and activity.',
      PAYMENTS:
        'Successful, pending, failed and refunded payment activity.',
      WALLETS:
        'Wallet balances, paid funds, free funds and locked balances.',
      SUBSCRIPTIONS:
        'Subscription plans, renewals, expiry and revenue.',
    };

    return map[type];
  }


  private prettyHeader(
    value: string,
  ): string {
    return value
      .replace(
        /([a-z0-9])([A-Z])/g,
        '$1 $2',
      )
      .replace(
        /^./,
        (letter) =>
          letter.toUpperCase(),
      );
  }


  private columnLetter(
    number: number,
  ): string {
    let result = '';
    let current = number;

    while (current > 0) {
      current--;

      result =
        String.fromCharCode(
          65 + (current % 26),
        ) + result;

      current =
        Math.floor(current / 26);
    }

    return result;
  }


  private excelCellValue(
    value: unknown,
  ): string | number {
    if (
      value === null ||
      value === undefined ||
      value === ''
    ) {
      return '-';
    }

    if (value instanceof Date) {
      return this.excelDateTime(
        value,
      );
    }

    if (
      typeof value === 'boolean'
    ) {
      return value
        ? 'Yes'
        : 'No';
    }

    if (
      Array.isArray(value)
    ) {
      return value.join(' • ');
    }

    if (
      typeof value === 'number'
    ) {
      return value;
    }

    if (
      typeof value === 'object'
    ) {
      const object =
        value as any;

      if (
        object?.constructor
          ?.name === 'Decimal'
      ) {
        const parsed =
          Number(
            object.toString(),
          );

        return Number.isNaN(parsed)
          ? object.toString()
          : parsed;
      }

      return JSON.stringify(
        value,
      );
    }

    return String(value);
  }


  private excelDate(
    date: Date,
  ): string {
    return new Intl.DateTimeFormat(
      'en-GB',
      {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        timeZone: 'UTC',
      },
    ).format(date);
  }


  private excelDateTime(
    date: Date,
  ): string {
    return new Intl.DateTimeFormat(
      'en-GB',
      {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false,
        timeZone: 'UTC',
      },
    ).format(date);
  }


  private isMoneyColumn(
    key: string,
  ): boolean {
    const lower =
      key.toLowerCase();

    return (
      lower.includes('amount') ||
      lower.includes('balance') ||
      lower.includes('price')
    );
  }


  private isNumericColumn(
    key: string,
  ): boolean {
    const lower =
      key.toLowerCase();

    return (
      this.isMoneyColumn(key) ||
      lower.includes('minutes') ||
      lower.includes('duration') ||
      lower.includes('rating') ||
      lower.includes('reviews') ||
      lower.includes('count') ||
      lower.includes('experience')
    );
  }


  private buildExcelFilename(
    type: AdminReportType,
    startDate?: Date,
    endDate?: Date,
  ): string {
    const from = startDate
      ? startDate
          .toISOString()
          .slice(0, 10)
      : 'all';

    const to = endDate
      ? endDate
          .toISOString()
          .slice(0, 10)
      : 'current';

    const label =
      this.reportDisplayTitle(
        type,
      ).replace(/\s+/g, '_');

    return (
      `AstroSoulPath_${label}_` +
      `${from}_to_${to}.xlsx`
    );
  }

  private toProfessionalCsv(
    reportType: AdminReportType,
    startDate: Date | undefined,
    endDate: Date | undefined,
    rows: Record<string, unknown>[],
  ) {
    const generatedAt =
      new Date().toISOString();

    const range =
      startDate || endDate
        ? `${startDate?.toISOString() ?? 'Beginning'} to ${endDate?.toISOString() ?? 'Current'}`
        : 'All records';

    const metadata = [
      ['Company', 'Astro Soul Path'],
      [
        'Report',
        this.reportTitle(reportType),
      ],
      ['Generated At', generatedAt],
      ['Period', range],
      [
        'Total Records',
        String(rows.length),
      ],
      [],
    ];

    if (!rows.length) {
      return (
        '\uFEFF' +
        metadata
          .map((row) =>
            row
              .map((cell) =>
                this.escapeCsv(cell),
              )
              .join(','),
          )
          .join('\r\n') +
        '\r\nNo records found'
      );
    }

    const headers = Object.keys(rows[0]);

    const body = [
      ...metadata,
      headers,
      ...rows.map((row) =>
        headers.map((header) =>
          this.normalizeValue(row[header]),
        ),
      ),
    ];

    return (
      '\uFEFF' +
      body
        .map((row) =>
          row
            .map((cell) =>
              this.escapeCsv(cell),
            )
            .join(','),
        )
        .join('\r\n')
    );
  }

  private normalizeValue(
    value: unknown,
  ): string {
    if (
      value === null ||
      value === undefined
    ) {
      return '';
    }

    if (value instanceof Date) {
      return value.toISOString();
    }

    if (
      typeof value === 'object' &&
      value !== null
    ) {
      if (
        typeof (value as any).toString ===
          'function' &&
        (value as any).constructor?.name ===
          'Decimal'
      ) {
        return (value as any).toString();
      }

      return JSON.stringify(value);
    }

    return String(value);
  }

  private escapeCsv(
    value: unknown,
  ) {
    const text =
      this.normalizeValue(value);

    return `"${text.replace(/"/g, '""')}"`;
  }

  private buildFilename(
    type: AdminReportType,
    startDate?: Date,
    endDate?: Date,
  ) {
    const from = startDate
      ? startDate
          .toISOString()
          .slice(0, 10)
      : 'all';

    const to = endDate
      ? endDate
          .toISOString()
          .slice(0, 10)
      : 'current';

    const label =
      this.reportTitle(type)
        .replace(/\s+/g, '_');

    return `AstroSoulPath_${label}_${from}_to_${to}.csv`;
  }

  private reportTitle(
    type: AdminReportType,
  ) {
    const titles: Record<
      AdminReportType,
      string
    > = {
      CUSTOMERS: 'Customer_Report',
      ASTROLOGERS: 'Astrologer_Report',
      CONSULTATIONS:
        'Consultation_Report',
      PAYMENTS: 'Payment_Report',
      WALLETS: 'Wallet_Report',
      SUBSCRIPTIONS:
        'Subscription_Report',
    };

    return titles[type];
  }
}


