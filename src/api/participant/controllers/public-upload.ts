"use strict";

module.exports = {
  async uploadReceipt(ctx) {
    const { docCode, folderName, eventId } = ctx.request.body;
    const files = ctx.request.files?.file || ctx.request.files?.files;

    console.log("📩 docCode:", docCode);
    console.log("📁 folderName:", folderName);
    console.log("🎯 eventId:", eventId);
    console.log("📎 archivo recibido:", files?.originalFilename || files?.name);

    // Validaciones básicas
    if (!docCode || !folderName || !eventId || !files) {
      return ctx.badRequest(
        "Faltan campos requeridos: código, folder, evento o archivo."
      );
    }

    // 1. Buscar participante
    console.log("1. Buscar participante");

    const participant = await strapi.db
      .query("api::participant.participant")
      .findOne({
        where: {
          documentId: {
            $startsWith: docCode,
          },
        },
        populate: {
          event: true,
          payment: true,
        },
      });

    if (!participant) {
      return ctx.notFound("Participante no encontrado.");
    }

    // 2. Eliminar archivo previo (si existe)
    console.log("2. Eliminar archivo previo (si existe)");
    if (participant.payment && participant.payment.length > 0) {
      const fileIds = participant.payment.map((f) => f.id);
      await Promise.all(
        fileIds.map((id) =>
          strapi.plugins["upload"].services.upload.remove({ id })
        )
      );
    }

    // 3. Buscar o crear carpeta del evento
    console.log("3. Buscar o crear carpeta del evento");
    const folders = await strapi.entityService.findMany(
      "plugin::upload.folder",
      {
        // filters: { pathId: Number(eventId) },
        filters: { path: folderName },
        limit: 1,
      }
    );

    let folderId = folders[0]?.id;
    console.log(folderId);

    if (!folderId) {
      try {
        const newFolder = await strapi.entityService.create(
          "plugin::upload.folder",
          {
            data: {
              name: folderName,
              path: folderName,
              pathId: Number(eventId),
              parent: null,
            },
          }
        );
        folderId = newFolder.id;
        console.log("📂 Carpeta creada:", folderId);
      } catch (error) {
        console.error("❌ Error al crear carpeta:", error);
        return ctx.internalServerError(
          "No se pudo crear la carpeta para el evento."
        );
      }
    }

    // 4. Renombrar archivo
    console.log("4. Renombrar archivo");
    const fileToUpload = Array.isArray(files) ? files[0] : files;
    const originalName =
      fileToUpload.originalFilename || fileToUpload.name || "archivo.png";
    const extension = originalName.split(".").pop()?.toLowerCase() || "png";

    const allowedExtensions = ["png", "jpg", "jpeg"];
    if (!allowedExtensions.includes(extension)) {
      return ctx.badRequest(`Tipo de archivo no permitido: ${extension}`);
    }

    const now = new Date();
    const pad = (n: number) => n.toString().padStart(2, "0");
    const formattedDate = `${pad(now.getDate())}-${pad(now.getMonth() + 1)}-${now.getFullYear()}_${pad(now.getHours())}-${pad(now.getMinutes())}-${pad(now.getSeconds())}`;
    const newFileName = `${docCode}_${folderName}_${formattedDate}.${extension}`;

    // 5. Subir archivo sin asociación aún
    console.log("5. Subir archivo sin asociación aún");
    let uploadedFiles;
    try {
      uploadedFiles = await strapi.plugins["upload"].services.upload.upload({
        data: {},
        files: fileToUpload,
      });
    } catch (error) {
      console.error("❌ Error al subir archivo:", error);
      return ctx.internalServerError("No se pudo subir el archivo.");
    }

    const uploaded = uploadedFiles[0];
    const fileId = uploaded.id;

    // 6. Actualizar archivo: renombrar + mover a carpeta
    console.log("6. Actualizar archivo: renombrar + mover a carpeta");
    let updatedFile;
    try {
      updatedFile = await strapi.entityService.update(
        "plugin::upload.file",
        fileId,
        {
          data: {
            name: newFileName,
            folder: folderId,
          },
        }
      );
    } catch (error) {
      console.error("❌ Error al actualizar archivo:", error);
      return ctx.internalServerError("No se pudo actualizar el archivo.");
    }

    // 7. Asociar el archivo al participante en el campo 'payment'
    console.log("7. Asociar el archivo al participante en el campo payment");
    try {
      await strapi.entityService.update(
        "api::participant.participant",
        participant.id,
        {
          data: {
            payment: [fileId],
            // publishedAt: new Date().toISOString(),
          },
        }
      );
      // Verificar si el registro sigue en draft
      // const updated = await strapi.entityService.findOne(
      //   "api::participant.participant",
      //   participant.id
      // );
      // if (!updated.publishedAt) {
      //   await strapi.entityService.update(
      //     "api::participant.participant",
      //     participant.id,
      //     {
      //       data: {
      //         publishedAt: new Date().toISOString(),
      //       },
      //     }
      //   );
      // }
    } catch (error) {
      console.error("❌ Error al asociar archivo al participante:", error);
      return ctx.internalServerError(
        "No se pudo asociar el archivo al participante."
      );
    }

    return ctx.send({
      success: true,
      participant: {
        id: participant.id,
        documentId: participant.documentId,
        event: participant.event?.name || null,
      },
      file: updatedFile,
    });
  },
};
