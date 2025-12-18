import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CourseVersionStatus } from '@prisma/client';

const SCHEMA_VERSION = '1.0.0';

// Types for export/import
export interface ExportMeta {
  exportedAt: string;
  exportedBy: string;
  schemaVersion: string;
}

export interface ExportedOption {
  externalId: string;
  text: string;
  isCorrect: boolean;
  sortOrder: number;
}

export interface ExportedQuestion {
  externalId: string;
  text: string;
  type: string;
  justificationRequired: boolean;
  sortOrder: number;
  options: ExportedOption[];
}

export interface ExportedQuiz {
  externalId: string;
  title: string | null;
  minScore: number;
  questions: ExportedQuestion[];
}

export interface ExportedCompetency {
  externalId: string;
  name: string;
  description: string | null;
}

export interface ExportedLesson {
  externalId: string;
  title: string;
  description: string | null;
  youtubeVideoId: string | null;
  durationSeconds: number;
  minWatchPercent: number;
  practicalSummary: string | null;
  tomorrowChecklist: string | null;
  status: string;
  sortOrder: number;
  quiz: ExportedQuiz | null;
  competencyIds: string[]; // References to externalIds of competencies
}

export interface ExportedModule {
  externalId: string;
  title: string;
  description: string | null;
  status: string;
  sortOrder: number;
  lessons: ExportedLesson[];
}

export interface ExportedFAQ {
  externalId: string;
  question: string;
  answer: string;
  status: string;
}

export interface ExportedCompetencyQuestionLink {
  competencyExternalId: string;
  questionExternalId: string;
}

export interface CourseExport {
  exportMeta: ExportMeta;
  course: {
    externalId: string;
    title: string;
    description: string | null;
    status: string;
    sortOrder: number;
  };
  modules: ExportedModule[];
  competencies: ExportedCompetency[];
  competencyQuestionBank: ExportedCompetencyQuestionLink[];
  faqs: ExportedFAQ[];
}

export interface ImportValidationResult {
  valid: boolean;
  counts: {
    modules: number;
    lessons: number;
    quizzes: number;
    questions: number;
    options: number;
    competencies: number;
    competencyQuestionLinks: number;
    faqs: number;
  };
  warnings: string[];
  errors: string[];
}

export interface ImportResult {
  success: boolean;
  courseId: string;
  importBatchId: string;
  counts: ImportValidationResult['counts'];
}

@Injectable()
export class ContentManagementService {
  constructor(private prisma: PrismaService) {}

  async exportCourse(
    courseId: string,
    instituteId: string,
    userId: string,
  ): Promise<CourseExport> {
    // Fetch course with all related data
    const course = await this.prisma.course.findFirst({
      where: { id: courseId, instituteId },
      include: {
        modules: {
          orderBy: { sortOrder: 'asc' },
          include: {
            lessons: {
              orderBy: { sortOrder: 'asc' },
              include: {
                quiz: {
                  include: {
                    questions: {
                      orderBy: { sortOrder: 'asc' },
                      include: {
                        options: { orderBy: { sortOrder: 'asc' } },
                        competencyQuestionBank: true,
                      },
                    },
                  },
                },
                lessonCompetencies: {
                  include: { competency: true },
                },
              },
            },
          },
        },
        faqs: true,
      },
    });

    if (!course) {
      throw new NotFoundException('Curso não encontrado');
    }

    // Collect all competencies referenced
    const competencyMap = new Map<string, ExportedCompetency>();
    const competencyQuestionLinks: ExportedCompetencyQuestionLink[] = [];

    // Build export structure
    const exportedModules: ExportedModule[] = course.modules.map((mod) => ({
      externalId: mod.id,
      title: mod.title,
      description: mod.description,
      status: mod.status,
      sortOrder: mod.sortOrder,
      lessons: mod.lessons.map((lesson) => {
        // Collect competencies from lesson
        const competencyIds: string[] = [];
        for (const lc of lesson.lessonCompetencies) {
          const comp = lc.competency;
          if (!competencyMap.has(comp.id)) {
            competencyMap.set(comp.id, {
              externalId: comp.id,
              name: comp.name,
              description: comp.description,
            });
          }
          competencyIds.push(comp.id);
        }

        // Build quiz if exists
        let exportedQuiz: ExportedQuiz | null = null;
        if (lesson.quiz) {
          const questions: ExportedQuestion[] = lesson.quiz.questions.map(
            (q) => {
              // Collect competency-question links
              for (const cqb of q.competencyQuestionBank) {
                competencyQuestionLinks.push({
                  competencyExternalId: cqb.competencyId,
                  questionExternalId: q.id,
                });
                // Ensure competency is in map (fetch if needed)
              }

              return {
                externalId: q.id,
                text: q.text,
                type: q.type,
                justificationRequired: q.justificationRequired,
                sortOrder: q.sortOrder,
                options: q.options.map((opt) => ({
                  externalId: opt.id,
                  text: opt.text,
                  isCorrect: opt.isCorrect,
                  sortOrder: opt.sortOrder,
                })),
              };
            },
          );

          exportedQuiz = {
            externalId: lesson.quiz.id,
            title: lesson.quiz.title,
            minScore: lesson.quiz.minScore,
            questions,
          };
        }

        return {
          externalId: lesson.id,
          title: lesson.title,
          description: lesson.description,
          youtubeVideoId: lesson.youtubeVideoId,
          durationSeconds: lesson.durationSeconds,
          minWatchPercent: lesson.minWatchPercent,
          practicalSummary: lesson.practicalSummary,
          tomorrowChecklist: lesson.tomorrowChecklist,
          status: lesson.status,
          sortOrder: lesson.sortOrder,
          quiz: exportedQuiz,
          competencyIds,
        };
      }),
    }));

    // Fetch competencies referenced in competencyQuestionBank that aren't already in map
    const uniqueCompetencyIds = [
      ...new Set(competencyQuestionLinks.map((l) => l.competencyExternalId)),
    ];
    for (const compId of uniqueCompetencyIds) {
      if (!competencyMap.has(compId)) {
        const comp = await this.prisma.competency.findUnique({
          where: { id: compId },
        });
        if (comp) {
          competencyMap.set(comp.id, {
            externalId: comp.id,
            name: comp.name,
            description: comp.description,
          });
        }
      }
    }

    // Export FAQs
    const exportedFaqs: ExportedFAQ[] = course.faqs.map((faq) => ({
      externalId: faq.id,
      question: faq.question,
      answer: faq.answer,
      status: faq.status,
    }));

    // Get user name for export
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { name: true },
    });

    return {
      exportMeta: {
        exportedAt: new Date().toISOString(),
        exportedBy: user?.name || userId,
        schemaVersion: SCHEMA_VERSION,
      },
      course: {
        externalId: course.id,
        title: course.title,
        description: course.description,
        status: course.status,
        sortOrder: course.sortOrder,
      },
      modules: exportedModules,
      competencies: Array.from(competencyMap.values()),
      competencyQuestionBank: competencyQuestionLinks,
      faqs: exportedFaqs,
    };
  }

  async validateImport(
    payload: CourseExport,
    instituteId: string,
  ): Promise<ImportValidationResult> {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Validate schema version
    if (!payload.exportMeta?.schemaVersion) {
      errors.push('schemaVersion ausente no exportMeta');
    } else if (payload.exportMeta.schemaVersion !== SCHEMA_VERSION) {
      warnings.push(
        `schemaVersion diferente: esperado ${SCHEMA_VERSION}, recebido ${payload.exportMeta.schemaVersion}`,
      );
    }

    // Validate course
    if (!payload.course) {
      errors.push('Dados do curso ausentes');
    } else {
      if (!payload.course.title) {
        errors.push('Título do curso é obrigatório');
      }
      if (!payload.course.externalId) {
        errors.push('externalId do curso é obrigatório');
      }
    }

    // Check for duplicate import
    if (payload.course?.externalId) {
      const existing = await this.prisma.course.findFirst({
        where: {
          instituteId,
          metadata: {
            path: ['externalId'],
            equals: payload.course.externalId,
          },
        },
      });
      if (existing) {
        errors.push(
          `Curso com externalId ${payload.course.externalId} já foi importado (id: ${existing.id}). Remova-o antes de reimportar.`,
        );
      }
    }

    // Count entities
    let lessonsCount = 0;
    let quizzesCount = 0;
    let questionsCount = 0;
    let optionsCount = 0;

    // Validate modules and lessons
    if (!payload.modules || !Array.isArray(payload.modules)) {
      errors.push('Módulos ausentes ou formato inválido');
    } else {
      for (const mod of payload.modules) {
        if (!mod.title) {
          errors.push(`Módulo sem título (externalId: ${mod.externalId})`);
        }
        if (!mod.externalId) {
          errors.push('Módulo sem externalId');
        }

        if (mod.lessons && Array.isArray(mod.lessons)) {
          for (const lesson of mod.lessons) {
            lessonsCount++;
            if (!lesson.title) {
              errors.push(
                `Aula sem título (externalId: ${lesson.externalId})`,
              );
            }
            if (!lesson.externalId) {
              errors.push('Aula sem externalId');
            }

            if (lesson.quiz) {
              quizzesCount++;
              if (lesson.quiz.questions && Array.isArray(lesson.quiz.questions)) {
                for (const q of lesson.quiz.questions) {
                  questionsCount++;
                  if (!q.text) {
                    errors.push(
                      `Questão sem texto (externalId: ${q.externalId})`,
                    );
                  }
                  if (q.options && Array.isArray(q.options)) {
                    optionsCount += q.options.length;
                    const hasCorrect = q.options.some((o) => o.isCorrect);
                    if (!hasCorrect) {
                      warnings.push(
                        `Questão ${q.externalId} não tem opção correta`,
                      );
                    }
                  } else {
                    warnings.push(
                      `Questão ${q.externalId} não tem opções`,
                    );
                  }
                }
              }
            } else {
              warnings.push(`Aula ${lesson.externalId} (${lesson.title}) não tem quiz`);
            }
          }
        }
      }
    }

    // Validate competency references
    const competencyExternalIds = new Set(
      (payload.competencies || []).map((c) => c.externalId),
    );

    for (const mod of payload.modules || []) {
      for (const lesson of mod.lessons || []) {
        for (const compId of lesson.competencyIds || []) {
          if (!competencyExternalIds.has(compId)) {
            errors.push(
              `Aula ${lesson.externalId} referencia competência inexistente: ${compId}`,
            );
          }
        }
      }
    }

    // Validate competencyQuestionBank references
    const questionExternalIds = new Set<string>();
    for (const mod of payload.modules || []) {
      for (const lesson of mod.lessons || []) {
        if (lesson.quiz?.questions) {
          for (const q of lesson.quiz.questions) {
            questionExternalIds.add(q.externalId);
          }
        }
      }
    }

    for (const link of payload.competencyQuestionBank || []) {
      if (!competencyExternalIds.has(link.competencyExternalId)) {
        errors.push(
          `CompetencyQuestionBank referencia competência inexistente: ${link.competencyExternalId}`,
        );
      }
      if (!questionExternalIds.has(link.questionExternalId)) {
        errors.push(
          `CompetencyQuestionBank referencia questão inexistente: ${link.questionExternalId}`,
        );
      }
    }

    return {
      valid: errors.length === 0,
      counts: {
        modules: payload.modules?.length || 0,
        lessons: lessonsCount,
        quizzes: quizzesCount,
        questions: questionsCount,
        options: optionsCount,
        competencies: payload.competencies?.length || 0,
        competencyQuestionLinks: payload.competencyQuestionBank?.length || 0,
        faqs: payload.faqs?.length || 0,
      },
      warnings,
      errors,
    };
  }

  async importCourse(
    payload: CourseExport,
    instituteId: string,
    userId: string,
    mode: 'DRY_RUN' | 'APPLY',
  ): Promise<ImportValidationResult | ImportResult> {
    // Always validate first
    const validation = await this.validateImport(payload, instituteId);

    if (mode === 'DRY_RUN') {
      return validation;
    }

    if (!validation.valid) {
      throw new BadRequestException({
        message: 'Validação falhou. Execute DRY_RUN para ver os erros.',
        errors: validation.errors,
      });
    }

    const importBatchId = `import-${Date.now()}-${Math.random().toString(36).substring(7)}`;

    // Import in transaction
    return this.prisma.$transaction(async (tx) => {
      // Map old IDs to new IDs
      const competencyIdMap = new Map<string, string>();
      const questionIdMap = new Map<string, string>();

      // 1. Create competencies first
      for (const comp of payload.competencies || []) {
        const created = await tx.competency.create({
          data: {
            instituteId,
            name: comp.name,
            description: comp.description,
            metadata: {
              externalId: comp.externalId,
              importBatchId,
            },
          },
        });
        competencyIdMap.set(comp.externalId, created.id);
      }

      // 2. Create course
      const course = await tx.course.create({
        data: {
          instituteId,
          title: payload.course.title,
          description: payload.course.description,
          status: 'DRAFT',
          sortOrder: payload.course.sortOrder || 0,
          metadata: {
            externalId: payload.course.externalId,
            importBatchId,
          },
        },
      });

      // 3. Create course version
      const version = await tx.courseVersion.create({
        data: {
          instituteId,
          courseId: course.id,
          versionNumber: 1,
          status: CourseVersionStatus.DRAFT,
          createdByUserId: userId,
        },
      });

      // Update course with version reference
      await tx.course.update({
        where: { id: course.id },
        data: { currentDraftVersionId: version.id },
      });

      // 4. Create modules and lessons
      for (const mod of payload.modules || []) {
        const createdModule = await tx.module.create({
          data: {
            courseId: course.id,
            title: mod.title,
            description: mod.description,
            status: 'DRAFT',
            sortOrder: mod.sortOrder || 0,
            metadata: {
              externalId: mod.externalId,
              importBatchId,
            },
          },
        });

        for (const lesson of mod.lessons || []) {
          const createdLesson = await tx.lesson.create({
            data: {
              moduleId: createdModule.id,
              title: lesson.title,
              description: lesson.description,
              youtubeVideoId: lesson.youtubeVideoId,
              durationSeconds: lesson.durationSeconds || 0,
              minWatchPercent: lesson.minWatchPercent || 90,
              practicalSummary: lesson.practicalSummary,
              tomorrowChecklist: lesson.tomorrowChecklist,
              status: 'DRAFT',
              sortOrder: lesson.sortOrder || 0,
              metadata: {
                externalId: lesson.externalId,
                importBatchId,
              },
            },
          });

          // Create lesson-competency links
          for (const oldCompId of lesson.competencyIds || []) {
            const newCompId = competencyIdMap.get(oldCompId);
            if (newCompId) {
              await tx.lessonCompetency.create({
                data: {
                  lessonId: createdLesson.id,
                  competencyId: newCompId,
                },
              });
            }
          }

          // Create quiz if exists
          if (lesson.quiz) {
            const createdQuiz = await tx.quiz.create({
              data: {
                lessonId: createdLesson.id,
                title: lesson.quiz.title,
                minScore: lesson.quiz.minScore || 70,
                metadata: {
                  externalId: lesson.quiz.externalId,
                  importBatchId,
                },
              },
            });

            // Create questions
            for (const q of lesson.quiz.questions || []) {
              const createdQuestion = await tx.question.create({
                data: {
                  quizId: createdQuiz.id,
                  text: q.text,
                  type: q.type as any,
                  justificationRequired: q.justificationRequired || false,
                  sortOrder: q.sortOrder || 0,
                  metadata: {
                    externalId: q.externalId,
                    importBatchId,
                  },
                },
              });
              questionIdMap.set(q.externalId, createdQuestion.id);

              // Create options
              for (const opt of q.options || []) {
                await tx.option.create({
                  data: {
                    questionId: createdQuestion.id,
                    text: opt.text,
                    isCorrect: opt.isCorrect || false,
                    sortOrder: opt.sortOrder || 0,
                    metadata: {
                      externalId: opt.externalId,
                      importBatchId,
                    },
                  },
                });
              }
            }
          }
        }
      }

      // 5. Create competency-question links
      for (const link of payload.competencyQuestionBank || []) {
        const newCompId = competencyIdMap.get(link.competencyExternalId);
        const newQuestionId = questionIdMap.get(link.questionExternalId);
        if (newCompId && newQuestionId) {
          await tx.competencyQuestionBank.create({
            data: {
              competencyId: newCompId,
              questionId: newQuestionId,
            },
          });
        }
      }

      // 6. Create FAQs
      for (const faq of payload.faqs || []) {
        await tx.fAQ.create({
          data: {
            instituteId,
            courseId: course.id,
            question: faq.question,
            answer: faq.answer,
            status: 'DRAFT',
            createdByUserId: userId,
            metadata: {
              externalId: faq.externalId,
              importBatchId,
            },
          },
        });
      }

      // 7. Create audit log
      await tx.auditLog.create({
        data: {
          userId,
          action: 'COURSE_IMPORT',
          entity: 'Course',
          entityId: course.id,
          metadata: {
            importBatchId,
            sourceExternalId: payload.course.externalId,
            counts: validation.counts,
          },
        },
      });

      return {
        success: true,
        courseId: course.id,
        importBatchId,
        counts: validation.counts,
      };
    });
  }

  async publishCourse(
    courseId: string,
    instituteId: string,
    userId: string,
  ) {
    const course = await this.prisma.course.findFirst({
      where: { id: courseId, instituteId },
      include: {
        modules: {
          include: {
            lessons: {
              include: { quiz: { include: { questions: true } } },
            },
          },
        },
        versions: {
          orderBy: { versionNumber: 'desc' },
          take: 1,
        },
      },
    });

    if (!course) {
      throw new NotFoundException('Curso não encontrado');
    }

    // Calculate counts
    const modulesCount = course.modules.length;
    const lessonsCount = course.modules.reduce(
      (acc, m) => acc + m.lessons.length,
      0,
    );
    const quizzesCount = course.modules.reduce(
      (acc, m) => acc + m.lessons.filter((l) => l.quiz).length,
      0,
    );
    const questionsCount = course.modules.reduce(
      (acc, m) =>
        acc +
        m.lessons.reduce(
          (acc2, l) => acc2 + (l.quiz?.questions.length || 0),
          0,
        ),
      0,
    );

    return this.prisma.$transaction(async (tx) => {
      // Audit: start
      await tx.auditLog.create({
        data: {
          userId,
          action: 'COURSE_PUBLISH_STARTED',
          entity: 'Course',
          entityId: courseId,
          metadata: {
            courseId,
            modulesCount,
            lessonsCount,
            quizzesCount,
            questionsCount,
          },
        },
      });

      let currentVersion = course.versions[0];
      let newVersionNumber = 1;

      if (currentVersion) {
        // Mark current draft as published
        await tx.courseVersion.update({
          where: { id: currentVersion.id },
          data: {
            status: CourseVersionStatus.PUBLISHED,
            publishedAt: new Date(),
          },
        });
        newVersionNumber = currentVersion.versionNumber + 1;
      } else {
        // Create first version if none exists
        currentVersion = await tx.courseVersion.create({
          data: {
            instituteId,
            courseId,
            versionNumber: 1,
            status: CourseVersionStatus.PUBLISHED,
            createdByUserId: userId,
            publishedAt: new Date(),
          },
        });
      }

      // Create new draft version for future edits
      const newDraftVersion = await tx.courseVersion.create({
        data: {
          instituteId,
          courseId,
          versionNumber: newVersionNumber,
          status: CourseVersionStatus.DRAFT,
          createdByUserId: userId,
        },
      });

      // Update course status and version references
      const updatedCourse = await tx.course.update({
        where: { id: courseId },
        data: {
          status: 'PUBLISHED',
          currentPublishedVersionId: currentVersion.id,
          currentDraftVersionId: newDraftVersion.id,
        },
      });

      // Audit: complete
      await tx.auditLog.create({
        data: {
          userId,
          action: 'COURSE_PUBLISH_COMPLETED',
          entity: 'Course',
          entityId: courseId,
          metadata: {
            courseId,
            versionNumber: currentVersion.versionNumber,
            counts: {
              modules: modulesCount,
              lessons: lessonsCount,
              quizzes: quizzesCount,
              questions: questionsCount,
            },
          },
        },
      });

      return {
        course: updatedCourse,
        publishedVersion: currentVersion,
        newDraftVersion,
      };
    });
  }

  async getCourseVersions(courseId: string, instituteId: string) {
    const course = await this.prisma.course.findFirst({
      where: { id: courseId, instituteId },
    });

    if (!course) {
      throw new NotFoundException('Curso não encontrado');
    }

    const versions = await this.prisma.courseVersion.findMany({
      where: { courseId },
      orderBy: { versionNumber: 'desc' },
      select: {
        id: true,
        versionNumber: true,
        status: true,
        publishedAt: true,
        createdAt: true,
        createdByUserId: true,
      },
    });

    return {
      courseId,
      currentDraftVersionId: course.currentDraftVersionId,
      currentPublishedVersionId: course.currentPublishedVersionId,
      versions,
    };
  }
}
