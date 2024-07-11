import React, { useState } from "react";
import * as XLSX from "xlsx";
import { message, Upload, Table, Button, Checkbox } from "antd";
import { InboxOutlined, UploadOutlined } from "@ant-design/icons";
import ExcelJS from "exceljs";

const { Dragger } = Upload;

const UploadExcel = () => {
  const [data, setData] = useState([]);
  const [cols, setCols] = useState([]);
  const [images, setImages] = useState([]);

  const handleFile = async (file) => {
    const reader = new FileReader();
    const rABS = !!reader.readAsBinaryString;

    reader.onload = async (e) => {
      const bstr = e.target.result;
      const wb = XLSX.read(bstr, { type: rABS ? "binary" : "array" });
      const wsname = wb.SheetNames[0];
      const ws = wb.Sheets[wsname];

      if (ws) {
        let jsonData = XLSX.utils.sheet_to_json(ws, { header: 1 });
        jsonData = jsonData.filter(row => row.some(cell => cell !== null && cell !== undefined && cell !== ''));

        setData(jsonData);
        setCols(makeCols(ws, jsonData[0] || []));
        await extractImages(file, jsonData);
      } else {
        message.error("Failed to parse Excel sheet.");
      }
    };

    if (rABS) reader.readAsBinaryString(file);
    else reader.readAsArrayBuffer(file);
  };

  const makeCols = (ws, headers) => {
    const range = XLSX.utils.decode_range(ws["!ref"]);
    const cols = [];
    for (let i = range.s.c; i <= range.e.c; ++i) {
      const header = headers[i] ? headers[i] : `Column ${i}`;
      if (header) {
        cols.push({ name: header, key: i });
      }
    }
    return cols;
  };

  const exportFile = () => {
    const ws = XLSX.utils.aoa_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "SheetJS");
    XLSX.writeFile(wb, "sheetjs.xlsx");
  };

  const exportJson = () => {
    const json = JSON.stringify(convertToJson(data.slice(1)));
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "data.json";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const convertToJson = (dataArray) => {
    const keys = ["ProductID", "ProductName", "Category", "Price", "Department", "Brand"];
    return dataArray.map(row => {
      const obj = {};
      keys.forEach((key, index) => {
        obj[key] = row[index];
      });
      return obj;
    });
  };

  const props = {
    name: "file",
    multiple: false,
    beforeUpload(file) {
      const isExcel =
        file.type ===
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" ||
        file.type === "application/vnd.ms-excel";
      if (!isExcel) {
        message.error(`${file.name} is not an Excel file.`);
      }
      return isExcel || Upload.LIST_IGNORE;
    },
    onChange(info) {
      const { originFileObj } = info.file;
      handleFile(originFileObj);
    },
    onDrop(e) {
      console.log("Dropped files", e.dataTransfer.files);
    },
  };

  const handleCheckboxChange = (record) => {
    console.log("Checkbox changed for record:", record);
  };

  const extractImages = async (file, jsonData) => {
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(file);
    const imageArray = [];
    const imageMap = {};

    workbook.eachSheet((sheet) => {
      sheet.getImages().forEach(image => {
        const imageId = image.imageId;
        const workbookImage = workbook.model.media.find(m => m.index === imageId);

        if (!workbookImage) return;

        const base64String = workbookImage.buffer.toString('base64');
        const imageName = workbookImage.name;

        if (!imageMap[imageName]) {
          const imageSrc = `data:image/png;base64,${base64String}`;
          imageMap[imageName] = imageSrc;
          imageArray.push({
            index: imageId,
            name: imageName,
            src: imageSrc
          });
        }
      });
    });

    const updatedData = jsonData.map((row) => {
      const imageName = row[1];
      const imageSrc = imageMap[imageName];
      return imageSrc ? { ...row, "Product Image": imageSrc } : { ...row, "Product Image": "" };
    });

    setData(updatedData);
    setImages(imageArray);
  };

  const handleFileChange = (fileList, recordIndex) => {
    const selectedFile = fileList[0]?.originFileObj;
    const imageUrl = selectedFile ? URL.createObjectURL(selectedFile) : "";

    const updatedData = data.map((row, index) => {
      if (index === recordIndex + 1) {
        return { ...row, "Product Image": imageUrl };
      }
      return row;
    });

    setData(updatedData);
  };

  const columnsWithCheckboxAndImage = [
    {
      title: "",
      dataIndex: "checkbox",
      key: "checkbox",
      render: (_, record) => (
        <Checkbox
          defaultChecked={true}
          onChange={() => handleCheckboxChange(record)}
        />
      ),
    },
    ...cols.map((col) => ({
      title: col.name,
      dataIndex: col.key,
      key: col.key,
    })),
    {
      title: "Product Image",
      dataIndex: "Product Image",
      key: "Product Image",
      render: (src, record, index) => src ? <img src={src} alt="Excel Image" style={{ maxWidth: 100 }} /> : (
        <Upload
          accept=".jpg, .jpeg, .png"
          fileList={[]}
          customRequest={({ file, onSuccess }) => {
            setTimeout(() => {
              onSuccess("ok");
            }, 0);
          }}
          onChange={({ fileList }) => {
            handleFileChange(fileList, index);
          }}
        >
          <Button icon={<UploadOutlined />}>Upload Images</Button>
        </Upload>
      ),
    },
  ];

  return (
    <>
      <Dragger {...props}>
        <p className="ant-upload-drag-icon">
          <InboxOutlined />
        </p>
        <p className="ant-upload-text">
          Click or drag file to this area to upload
        </p>
        <p className="ant-upload-hint">
          Support for a single upload. Strictly prohibited from uploading
          company data or other banned files.
        </p>
      </Dragger>
      <Table
        dataSource={data.slice(1).map((row, index) => ({ key: index, ...row }))}
        columns={columnsWithCheckboxAndImage}
        style={{ marginTop: 16 }}
      />
      <Button
        type="primary"
        onClick={exportFile}
        disabled={!data.length}
        style={{ marginTop: 16 }}
      >
        Export to Excel
      </Button>
      <Button
        type="primary"
        onClick={exportJson}
        disabled={!data.length}
        style={{ marginTop: 16, marginLeft: 16 }}
      >
        Export to JSON
      </Button>
    </>
  );
};

export default UploadExcel;
