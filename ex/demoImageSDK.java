import java.io.IOException;
import java.awt.image.BufferedImage;
import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.io.DataInputStream;
import java.io.FileInputStream;
import java.io.DataOutputStream;
import java.io.FileOutputStream;
import java.io.File;
import java.nio.file.Files;
import java.nio.file.Paths;
import java.nio.file.Path;
import java.util.Arrays;
import java.util.Scanner;
import javax.imageio.ImageIO;
import com.suprema.ImageSDK;
import java.nio.charset.StandardCharsets;

public class demoImageSDK {
	
	public static ImageSDK libSDK = new ImageSDK();
	
	static long[] hExtractorContainer = new long[1];
	static long[] hMatcherContainer = new long[1];
	
	final static int MAX_TEMPLATE_SIZE = 1024;
	final static int MAX_IMAGE_BUFFER_SIZE = 1000000;
	public static byte[] mTemplate = new byte[MAX_TEMPLATE_SIZE];
	public static byte[] mImage = new byte[MAX_IMAGE_BUFFER_SIZE];
	public static int mImageWidth = -1;
	public static int mImageHeight = -1;
	public static int mTemplateType = 1; // suprema format
	
	public static String GetUFEErrorString(int err){
		byte[] errByte = new byte[256];
		Arrays.fill( errByte, (byte) 0 );
		libSDK.UFE_GetErrorString(err, errByte);
		
		String str = new String(errByte, StandardCharsets.UTF_8);
		String emptyRemoved = str.replaceAll("\u0000.*", "");
		return emptyRemoved;
	}
	
	public static String GetUFMErrorString(int err){
		byte[] errByte = new byte[256];
		Arrays.fill( errByte, (byte) 0 );
		libSDK.UFM_GetErrorString(err, errByte);
		
		String str = new String(errByte, StandardCharsets.UTF_8);
		String emptyRemoved = str.replaceAll("\u0000.*", "");
		return emptyRemoved;
	}
	
	public static void SaveBytes(byte[] baTemplate, int nTemplateSize, String filename)
	{
		try {
			byte[] templateToSave = new byte[nTemplateSize];
			System.arraycopy( baTemplate, 0, templateToSave, 0, nTemplateSize );
			FileOutputStream fos = new FileOutputStream(filename);
			fos.write(templateToSave);
			fos.close();
		} catch (IOException e) {
			// do nothing
		}
	}
	
	public static void OnInit(){
		int result = libSDK.UFE_Create(hExtractorContainer);
		if(result == libSDK.UFE_OK)
		{
			System.out.println("UFE_Create() result : " + result);
		}
		
		result = libSDK.UFM_Create(hMatcherContainer);
		if(result == libSDK.UFM_OK)
		{
			System.out.println("UFM_Create() result : " + result);
		}
		else {
			System.out.println(GetUFMErrorString(result));
		}
	}
	
	public static void OnDelete(){
		if (hExtractorContainer == null){
		}
		else{
			int result = libSDK.UFE_Delete(hExtractorContainer[0]);
			if(result == libSDK.UFE_OK){
				System.out.println("UFE_Delete() result : " + result);
			}
			
			result = libSDK.UFM_Delete(hMatcherContainer[0]);
			if(result == libSDK.UFM_OK){
				System.out.println("UFM_Delete() result : " + result);
			}
			else {
				System.out.println(GetUFMErrorString(result));
			}
		}
	}
	
	public static void OnSetParameter(){
		if(hMatcherContainer != null){
			int usr_input = -1;
			Scanner in = new Scanner(System.in);
			int[] nValue = new int[1];
			int result;
			
			System.out.print("Fast Mode (0,1) = ");
			usr_input = in.nextInt();
					
			switch(usr_input){
				case 0:
					nValue[0] = 0;
					break;
				case 1:
					nValue[0] = 1;
					break;
				default:
					System.out.println("Wrong number...");
					break;
			}
			
			result = libSDK.UFM_SetParameter(hMatcherContainer[0], libSDK.UFM_PARAM_FAST_MODE, nValue);
			
			System.out.print("Security Level (1~7) = ");
			usr_input = in.nextInt();
					
			if (usr_input > 0 && usr_input < 8){
				nValue[0] = usr_input;
				result = libSDK.UFM_SetParameter(hMatcherContainer[0], libSDK.UFM_PARAM_SECURITY_LEVEL, nValue);
				if(result != libSDK.UFM_OK) {
					System.out.println(GetUFMErrorString(result));
				}
			}
			else{
				System.out.println("Wrong number...");
			}
		}
		
	}
	
	public static void OnGetParameter(){
		if(hMatcherContainer != null){
			int[] pValue = new int[1];
			int result = libSDK.UFM_GetParameter(hMatcherContainer[0], libSDK.UFM_PARAM_FAST_MODE, pValue);
			System.out.println("UFM_Fast_Mode : " + pValue[0]);
			result = libSDK.UFM_GetParameter(hMatcherContainer[0], libSDK.UFM_PARAM_SECURITY_LEVEL, pValue);
			System.out.println("UFM_Security_Level : " + pValue[0]);
			if(result != libSDK.UFM_OK) {
				System.out.println(GetUFMErrorString(result));
			}
		}
	}
	
	public static void OnVerify(){
		if(hMatcherContainer != null){
			byte[] pTemplate1 = new byte[MAX_TEMPLATE_SIZE];
			byte[] pTemplate2 = new byte[MAX_TEMPLATE_SIZE];
			int nTemplate1Size = 0;
			int nTemplate2Size = 0;
			int[] bVerifySucceed = new int[1];
			Scanner in = new Scanner(System.in);
			
			FileInputStream fis = null;
			ByteArrayInputStream bais = null;
			ByteArrayOutputStream baos = null;
			
			try{
				String imgPath;
				System.out.print("1st Template File Name (Finger1_1.bmp_suprema_type.dat): ");
				imgPath = in.nextLine();
				if(imgPath.isEmpty()) {
					imgPath = "Finger1_1.bmp_suprema_type.dat";
				}
				fis = new FileInputStream(imgPath);
				baos = new ByteArrayOutputStream();
				byte[] buffer = new byte[MAX_TEMPLATE_SIZE];
				int readcount = 0;
				
				while ((readcount = fis.read(buffer)) != -1){
					baos.write(buffer, 0, readcount);
				}
				
				byte[] fileArray = baos.toByteArray();
				nTemplate1Size = fileArray.length;
				pTemplate1 = Arrays.copyOf(fileArray, fileArray.length);
				
			} catch (Exception e){
				System.out.println(e);
			}
			
			try{
				String imgPath;
				System.out.print("2nd Template File Name (Finger1_2.bmp_suprema_type.dat): ");
				imgPath = in.nextLine();
				if(imgPath.isEmpty()) {
					imgPath = "Finger1_2.bmp_suprema_type.dat";
				}

				fis = new FileInputStream(imgPath);
				baos = new ByteArrayOutputStream();
				byte[] buffer = new byte[MAX_TEMPLATE_SIZE];
				int readcount = 0;
				
				while ((readcount = fis.read(buffer)) != -1){
					baos.write(buffer, 0, readcount);
				}
				
				byte[] fileArray = baos.toByteArray();
				nTemplate2Size = fileArray.length;
				pTemplate2 = Arrays.copyOf(fileArray, fileArray.length);
				
			} catch (Exception e){
				System.out.println(e);
			}
			
			int result = libSDK.UFM_Verify(hMatcherContainer[0], pTemplate1, nTemplate1Size, pTemplate2, nTemplate2Size, bVerifySucceed);
			System.out.println("UFM_Verify = " + result);
			System.out.println("Match: " + bVerifySucceed[0]);
			
			if(result != libSDK.UFM_OK) {
				System.out.println(GetUFMErrorString(result));
			}
		}
	}
	
	public static void OnIdentify(){
		if(hMatcherContainer != null){
			final int MAX_TEMPLATE_SIZE = 1024;
			byte[] pTemplate1 = new byte[MAX_TEMPLATE_SIZE];
			int nTemplate2Num = 10;
			byte[][] ppTemplate2 = new byte[MAX_TEMPLATE_SIZE][nTemplate2Num];
			int nTemplate1Size = 0;
			int[] pnTemplate2Size = new int[nTemplate2Num];
			int[] pnMatchTemplate2Index = new int[1];
			boolean flag = true;
			String path;
			
			FileInputStream fis = null;
			ByteArrayOutputStream baos = null;
			
			int usr_input = -1;
			Scanner in = new Scanner(System.in);
		
			try{
				String imgPath;
				System.out.print("1st Template File Name (Finger1_1.bmp_suprema_type.dat): ");
				imgPath = in.nextLine();
				if(imgPath.isEmpty()) {
					imgPath = "Finger1_1.bmp_suprema_type.dat";
				}

				fis = new FileInputStream(imgPath);
				baos = new ByteArrayOutputStream();
				byte[] buffer = new byte[MAX_TEMPLATE_SIZE];
				int readcount = 0;
				
				while ((readcount = fis.read(buffer)) != -1){
					baos.write(buffer, 0, readcount);
				}
				
				byte[] fileArray = baos.toByteArray();
				nTemplate1Size = fileArray.length;
				pTemplate1 = Arrays.copyOf(fileArray, fileArray.length);
				
			} catch (Exception e){
				System.out.println(e);
			}
			
			System.out.print("*" + (nTemplate2Num-1) + " Templates filename needed...");
			
			for (int i=2; i<=nTemplate2Num; i++){
			
				try{
					String imgPath;
					System.out.print("Enter the " + i + "th Template File Name (Finger1_" + i + ".bmp_suprema_type.dat): ");
					imgPath = in.nextLine();
					if(imgPath.isEmpty()) {
						imgPath = "Finger1_" + i + ".bmp_suprema_type.dat";
					}

					fis = new FileInputStream(imgPath);
					baos = new ByteArrayOutputStream();
					byte[] buffer = new byte[MAX_TEMPLATE_SIZE];
					int readcount = 0;
					
					while ((readcount = fis.read(buffer)) != -1){
						baos.write(buffer, 0, readcount);
					}
					
					byte[] fileArray = baos.toByteArray();
					pnTemplate2Size[i] = fileArray.length;
					ppTemplate2[i] = Arrays.copyOf(fileArray, fileArray.length);
					
					
				} catch(Exception e){
					System.out.println(e);
				}
				
			}
			
			int result = libSDK.UFM_Identify(hMatcherContainer[0], pTemplate1, nTemplate1Size, ppTemplate2, pnTemplate2Size, nTemplate2Num, 5000, pnMatchTemplate2Index);
			if(result == libSDK.UFM_OK) {
				System.out.println("Matched : " + pnMatchTemplate2Index[0]);
			}
			else {
				System.out.println(GetUFMErrorString(result));
			}
		}
	}
	
	public static void OnIdentifyMT(){
		if(hMatcherContainer != null){
			final int MAX_TEMPLATE_SIZE = 1024;
			byte[] pTemplate1 = new byte[MAX_TEMPLATE_SIZE];
			int nTemplate2Num = 10;
			byte[][] ppTemplate2 = new byte[MAX_TEMPLATE_SIZE][nTemplate2Num];
			int nTemplate1Size = 0;
			int[] pnTemplate2Size = new int[nTemplate2Num];
			int[] pnMatchTemplate2Index = new int[1];
			boolean flag = true;
			String path;
			
			
			FileInputStream fis = null;
			ByteArrayOutputStream baos = null;
			
			int usr_input = -1;
			Scanner in = new Scanner(System.in);
		
			// Finger1 into pTemplate1
			try{
				String imgPath;
				System.out.print("1st Template File Name (Finger1_1.bmp_suprema_type.dat): ");
				imgPath = in.nextLine();
				if(imgPath.isEmpty()) {
					imgPath = "Finger1_1.bmp_suprema_type.dat";
				}

				fis = new FileInputStream(imgPath);
				baos = new ByteArrayOutputStream();
				byte[] buffer = new byte[MAX_TEMPLATE_SIZE];
				int readcount = 0;
				
				while ((readcount = fis.read(buffer)) != -1){
					baos.write(buffer, 0, readcount);
				}
				
				byte[] fileArray = baos.toByteArray();
				nTemplate1Size = fileArray.length;
				pTemplate1 = Arrays.copyOf(fileArray, fileArray.length);
				
			} catch (Exception e){
				System.out.println(e);
			}
			
			System.out.print("*" + (nTemplate2Num-1) + " Templates filename needed...");
			
			for (int i=2; i<=nTemplate2Num; i++){
			
				try{
					String imgPath;
					System.out.print("Enter the " + i + "th Template File Name (Finger1_" + i + ".bmp_suprema_type.dat): ");
					imgPath = in.nextLine();
					if(imgPath.isEmpty()) {
						imgPath = "Finger1_" + i + ".bmp_suprema_type.dat";
					}

					fis = new FileInputStream(imgPath);
					baos = new ByteArrayOutputStream();
					byte[] buffer = new byte[MAX_TEMPLATE_SIZE];
					int readcount = 0;
					
					while ((readcount = fis.read(buffer)) != -1){
						baos.write(buffer, 0, readcount);
					}
					
					byte[] fileArray = baos.toByteArray();
					pnTemplate2Size[i] = fileArray.length;
					ppTemplate2[i] = Arrays.copyOf(fileArray, fileArray.length);
					
					
				} catch(Exception e){
					System.out.println(e);
				}
				
			}
			
			int result = libSDK.UFM_IdentifyMT(hMatcherContainer[0], pTemplate1, nTemplate1Size, ppTemplate2, pnTemplate2Size, nTemplate2Num, 5000, pnMatchTemplate2Index);
			System.out.println(result);
			System.out.println(pnMatchTemplate2Index[0]);
		}
	}
	
	public static void OnSetTemplateType(){
		
		int usr_input = -1;
		Scanner in = new Scanner(System.in);
		
		System.out.println("===================================");
		System.out.println("1. suprema type");
		System.out.println("2. iso type");
		System.out.println("3. ansi178 type");
		System.out.println("-----------------------------------");
		System.out.print("Set Template Type: ");
		
		usr_input = in.nextInt();
				
		switch(usr_input){
			case 1:
				libSDK.UFE_SetTemplateType(hExtractorContainer[0], libSDK.UFE_TEMPLATE_TYPE_SUPREMA);
				libSDK.UFM_SetTemplateType(hMatcherContainer[0], libSDK.UFE_TEMPLATE_TYPE_SUPREMA);
				System.out.println("Template type: suprema");
				break;
			case 2:
				libSDK.UFE_SetTemplateType(hExtractorContainer[0], libSDK.UFE_TEMPLATE_TYPE_ISO19794_2);
				libSDK.UFM_SetTemplateType(hMatcherContainer[0], libSDK.UFE_TEMPLATE_TYPE_ISO19794_2);
				System.out.println("Template type: iso");
				break;
			case 3:
				libSDK.UFE_SetTemplateType(hExtractorContainer[0], libSDK.UFE_TEMPLATE_TYPE_ANSI378);
				libSDK.UFM_SetTemplateType(hMatcherContainer[0], libSDK.UFE_TEMPLATE_TYPE_ANSI378);
				System.out.println("Template type: ansi");
				break;
			default:
				System.out.println("Wrong number...");
				break;
		}
		
		if(usr_input >= 1 && usr_input <= 3) mTemplateType = usr_input;
	}
	
	public static int OnGetTemplateType(){
		
		int[] templateType = new int[1];
		int result = libSDK.UFM_GetTemplateType(hMatcherContainer[0], templateType);
		if(result != libSDK.UFM_OK) {
			System.out.println(GetUFEErrorString(result));
			return 0;
		}
		int user_type = 0;
		switch(templateType[0]){
			case 2001:
				System.out.println("TemplateType : Suprema");
				user_type = 1;
				break;
			case 2002:
				System.out.println("TemplateType : ISO");
				user_type = 2;
				break;
			case 2003:
				System.out.println("TemplateType : ANSI378");
				user_type = 3;
				break;
		}
		return user_type;
	}
	
	public static void OnSetMode(){
		int usr_input = -1;
		Scanner in = new Scanner(System.in);
		
		System.out.println("===================================");
		System.out.println("Select Template Mode");
		System.out.println("  0:SFR200, 1:SFR300, 2:SFR300v2, 3:SFR300v2_Ver2,");
		System.out.println("  4:SFR500, 5:SFR600, 6:General[Default]");
		System.out.println("-----------------------------------");
		System.out.print("Set Mode : ");
		
		usr_input = in.nextInt();
		
		switch(usr_input){
		case 0:
			libSDK.UFE_SetMode(hExtractorContainer[0], libSDK.UFE_MODE_SFR200);
			break;
		case 1:
			libSDK.UFE_SetMode(hExtractorContainer[0], libSDK.UFE_MODE_SFR300);
			break;
		case 2:
			libSDK.UFE_SetMode(hExtractorContainer[0], libSDK.UFE_MODE_SFR300v2);
			break;
		case 3:
			libSDK.UFE_SetMode(hExtractorContainer[0], libSDK.UFE_MODE_SFR300v2_Ver2);
			break;
		case 4:
			libSDK.UFE_SetMode(hExtractorContainer[0], libSDK.UFE_MODE_SFR500);
			break;
		case 5:
			libSDK.UFE_SetMode(hExtractorContainer[0], libSDK.UFE_MODE_SFR600);
			break;
		case 6:
			libSDK.UFE_SetMode(hExtractorContainer[0], libSDK.UFE_MODE_GENERAL);
			break;
		default:
			libSDK.UFE_SetMode(hExtractorContainer[0], libSDK.UFE_MODE_GENERAL);
			break;
		}
	}
	
	public static void OnRotateTemplate(){
		final int MAX_TEMPLATE_SIZE = 1024;
		byte[] Template2 = new byte[MAX_TEMPLATE_SIZE];
		int nTemplateSize = 0;
		Scanner in = new Scanner(System.in);
		
		FileInputStream fis = null;
		ByteArrayOutputStream baos = null;
		
		String imgPath;
		System.out.print("Template File Name (Finger1_1.bmp_suprema_type.dat): ");
		imgPath = in.nextLine();
		if(imgPath.isEmpty()) {
			imgPath = "Finger1_1.bmp_suprema_type.dat";
		}

		try{
			fis = new FileInputStream(imgPath);
			baos = new ByteArrayOutputStream();
			byte[] buffer = new byte[MAX_TEMPLATE_SIZE];
			int readcount = 0;
			
			while ((readcount = fis.read(buffer)) != -1){
				baos.write(buffer, 0, readcount);
			}
			
			byte[] fileArray = baos.toByteArray();
			nTemplateSize = fileArray.length;
			Template2 = Arrays.copyOf(fileArray, fileArray.length);
			
		} catch (Exception e){
			System.out.println(e);
		}
		
		int result = libSDK.UFM_RotateTemplate(hMatcherContainer[0], Template2, nTemplateSize);
		
		if(result == libSDK.UFM_OK) {
			SaveBytes(Template2, nTemplateSize, imgPath + ".rot");
		}
		else {
			System.out.println(GetUFMErrorString(result));
		}
	}
	
	public static void OnExtract(){
		
		byte[] pImage = null;
		final int MAX_TEMPLATE_SIZE = 1024;
		
		byte[] pTemplate = new byte[MAX_TEMPLATE_SIZE];
		int[] pnTemplateSize = new int[1];
		int[] pnEnrollQuality = new int[1];
		
		FileInputStream fis = null;
		ByteArrayOutputStream baos = null;
		
		int usr_input = -1;
		Scanner in = new Scanner(System.in);
	
		int nWidth, nHeight, nResolution;
		String imgPath;
		
		System.out.println("=====Image Specification=====");
		System.out.print("Raw Image File Name (raw.raw): ");
		imgPath = in.nextLine();
		if(imgPath.isEmpty()) {
			imgPath = "raw.raw";
		}
		System.out.print("Image Width : ");
		nWidth = in.nextInt();
		System.out.print("Image Height : ");
		nHeight = in.nextInt();
		System.out.print("Resolution : ");
		nResolution = in.nextInt();
		
		try{
			fis = new FileInputStream(imgPath);
			baos = new ByteArrayOutputStream();
			byte[] buffer = new byte[MAX_TEMPLATE_SIZE];
			int readcount = 0;
			
			while ((readcount = fis.read(buffer)) != -1){
				baos.write(buffer, 0, readcount);
			}
			
			byte[] fileArray = baos.toByteArray();
			
			pImage = new byte[fileArray.length];
			pImage = Arrays.copyOf(fileArray, fileArray.length);
			
		} catch (Exception e){
			System.out.println(e);
		}

		int result = libSDK.UFE_Extract(hExtractorContainer[0], pImage, nWidth, nHeight, nResolution, pTemplate, pnTemplateSize, pnEnrollQuality);
		
		if(result == libSDK.UFE_OK) {
			SaveBytes(pTemplate, pnTemplateSize[0], imgPath + "_unknown_type.dat");
		}
		else {
			System.out.println(GetUFEErrorString(result));
		}
	}
	
	public static void OnSetEncryptionKey(){
		
		byte[] userKey = new byte[32];
		String usr_input;
		Scanner in = new Scanner(System.in);
		System.out.println("Please input encryption key : ");
		usr_input = in.nextLine();
		
		userKey = usr_input.getBytes();
		
		int result = libSDK.UFE_SetEncryptionKey(hExtractorContainer[0], userKey);
		if(result != libSDK.UFE_OK) {
			System.out.println(GetUFEErrorString(result));
		}
	}
	
	public static void OnEncryptTemplate(){
		final int MAX_TEMPLATE_SIZE = 1024;
		byte[] pTemplateInput = new byte[MAX_TEMPLATE_SIZE];
		byte[] pTemplateOutput = new byte[MAX_TEMPLATE_SIZE];
		int nTemplateSize = 0;
		int[] pnTemplateOutputSize = new int[1];
		Scanner in = new Scanner(System.in);
		
		FileInputStream fis = null;
		ByteArrayOutputStream baos = null;
		
		String imgPath;
		System.out.print("Template File Name (Finger1_1.bmp_suprema_type.dat): ");
		imgPath = in.nextLine();
		if(imgPath.isEmpty()) {
			imgPath = "Finger1_1.bmp_suprema_type.dat";
		}

		try{
			fis = new FileInputStream(imgPath);
			baos = new ByteArrayOutputStream();
			byte[] buffer = new byte[MAX_TEMPLATE_SIZE];
			int readcount = 0;
			
			while ((readcount = fis.read(buffer)) != -1){
				baos.write(buffer, 0, readcount);
			}
			
			byte[] fileArray = baos.toByteArray();
			nTemplateSize = fileArray.length;
			pTemplateInput = Arrays.copyOf(fileArray, fileArray.length);
			
		} catch (Exception e){
			System.out.println(e);
		}
		int result = libSDK.UFE_EncryptTemplate(hExtractorContainer[0], pTemplateInput, nTemplateSize, pTemplateOutput, pnTemplateOutputSize);
		
		if(result == libSDK.UFE_OK) {
			SaveBytes(pTemplateOutput, pnTemplateOutputSize[0], imgPath + ".enc");
		}
		else {
			System.out.println(GetUFEErrorString(result));
		}
	}
	
	public static void OnDecryptTemplate(){
		final int MAX_TEMPLATE_SIZE = 1024;
		byte[] pTemplateInput = new byte[MAX_TEMPLATE_SIZE];
		byte[] pTemplateOutput = new byte[MAX_TEMPLATE_SIZE];
		int nTemplateSize = 0;
		int[] pnTemplateOutputSize = new int[1];
		Scanner in = new Scanner(System.in);
		
		FileInputStream fis = null;
		ByteArrayOutputStream baos = null;
		
		String imgPath;
		System.out.print("Template File Name (Finger1_1.bmp_suprema_type.enc.dat): ");
		imgPath = in.nextLine();
		if(imgPath.isEmpty()) {
			imgPath = "Finger1_1.bmp_suprema_type.dat.enc";
		}

		try{
			fis = new FileInputStream(imgPath);
			baos = new ByteArrayOutputStream();
			byte[] buffer = new byte[MAX_TEMPLATE_SIZE];
			int readcount = 0;
			
			while ((readcount = fis.read(buffer)) != -1){
				baos.write(buffer, 0, readcount);
			}
			
			byte[] fileArray = baos.toByteArray();
			nTemplateSize = fileArray.length;
			pTemplateInput = Arrays.copyOf(fileArray, fileArray.length);
			
		} catch (Exception e){
			System.out.println(e);
		}
		int result = libSDK.UFE_DecryptTemplate(hExtractorContainer[0], pTemplateInput, nTemplateSize, pTemplateOutput, pnTemplateOutputSize);
		
		if(result == libSDK.UFE_OK) {
			SaveBytes(pTemplateOutput, pnTemplateOutputSize[0], imgPath + ".dec");
		}
		else {
			System.out.println(GetUFEErrorString(result));
		}
	}
	
	public static void OnLoadImageFromBMPFile(){
		int[] pnWidth = new int[1];
		int[] pnHeight = new int[1];
		Scanner in = new Scanner(System.in);

		String imgPath;
		System.out.print("Image File Name (Finger1_1.bmp): ");
		imgPath = in.nextLine();
		if(imgPath.isEmpty()) {
			imgPath = "Finger1_1.bmp";
		}
		
		int result = libSDK.UFE_LoadImageFromBMPFile(imgPath, mImage, pnWidth, pnHeight);
		mImageWidth = pnWidth[0];
		mImageHeight = pnHeight[0];
		if(result != libSDK.UFE_OK) {
			System.out.println(GetUFEErrorString(result));
		}
	}
	
	public static void OnLoadImageFromBMPBuffer(){
		
		byte[] pBMPBuffer = null;
		int nBMPBufferSize = -1;
		Scanner in = new Scanner(System.in);
		
		try{
			String imgPath;
			System.out.print("Image File Name (Finger1_1.bmp): ");
			imgPath = in.nextLine();
			if(imgPath.isEmpty()) {
				imgPath = "Finger1_1.bmp";
			}

			BufferedImage image = ImageIO.read(new File(imgPath));
			ByteArrayOutputStream baos = new ByteArrayOutputStream();
			ImageIO.write( image, "bmp", baos );
			baos.flush();
			pBMPBuffer = baos.toByteArray();
			nBMPBufferSize = pBMPBuffer.length;
			baos.close();

			int[] pnWidth = new int[1];
			int[] pnHeight = new int[1];
			
			int result = libSDK.UFE_LoadImageFromBMPBuffer(pBMPBuffer, nBMPBufferSize, mImage, pnWidth, pnHeight);
			mImageWidth = pnWidth[0];
			mImageHeight = pnHeight[0];
		}catch(Exception e){
			System.out.println(e);
		}
	}
	
	public static void OnLoadImageFromWSQFile(){
		// Failed (result = -1)
		int[] pnWidth = new int[1];
		int[] pnHeight = new int[1];
		Scanner in = new Scanner(System.in);
		
		String imgPath;
		System.out.print("WSQ File Name (Finger1_1.wsq): ");
		imgPath = in.nextLine();
		if(imgPath.isEmpty()) {
			imgPath = "Finger1_1.wsq";
		}

		int result = libSDK.UFE_LoadImageFromWSQFile(imgPath, mImage, pnWidth, pnHeight);
		mImageWidth = pnWidth[0];
		mImageHeight = pnHeight[0];

		if(result != libSDK.UFE_OK) {
			System.out.println(GetUFEErrorString(result));
		}
	}
	
	public static void OnLoadImageFromWSQBuffer(){
		byte[] pWSQBuffer = null;
		int nWSQBufferSize = -1;
		Scanner in = new Scanner(System.in);
		
		String imgPath;
		System.out.print("WSQ File Name (Finger1_1.wsq): ");
		imgPath = in.nextLine();
		if(imgPath.isEmpty()) {
			imgPath = "Finger1_1.wsq";
		}

		Path path = Paths.get(imgPath);
		try{
			pWSQBuffer = Files.readAllBytes(path);
			nWSQBufferSize = pWSQBuffer.length;
		}catch(Exception e){
			System.out.println(e);
		}
		
		int[] pnWidth = new int[1];
		int[] pnHeight = new int[1];
		
		int result = libSDK.UFE_LoadImageFromWSQBuffer(pWSQBuffer, nWSQBufferSize, mImage, pnWidth, pnHeight);
		mImageWidth = pnWidth[0];
		mImageHeight = pnHeight[0];
		
		if(result != libSDK.UFE_OK) {
			System.out.println(GetUFEErrorString(result));
		}
	}
	
	public static void OnGetImageBufferTo19794_4ImageBuffer(){
		
		byte[] pImageOut = new byte[MAX_IMAGE_BUFFER_SIZE];
		int[] ImageLengthOut = new int[1];
		Scanner in = new Scanner(System.in);
		int result;

		if(mImageWidth > 1 && mImageHeight > 1) {
			result = libSDK.UFE_GetImageBufferTo19794_4ImageBuffer(hExtractorContainer[0], mImage, mImageWidth, mImageHeight, pImageOut, ImageLengthOut);
		}
		else {
			byte[] pImage = new byte[MAX_IMAGE_BUFFER_SIZE];
			int[] pnWidth = new int[1];
			int[] pnHeight = new int[1];

			String imgPath;
			System.out.print("Image File Name (Finger1_1.bmp): ");
			imgPath = in.nextLine();
			if(imgPath.isEmpty()) {
				imgPath = "Finger1_1.bmp";
			}
			
			result = libSDK.UFE_LoadImageFromBMPFile(imgPath, mImage, pnWidth, pnHeight);
			mImageWidth = pnWidth[0];
			mImageHeight = pnHeight[0];
		
			result = libSDK.UFE_GetImageBufferTo19794_4ImageBuffer(hExtractorContainer[0], pImage, pnWidth[0], pnHeight[0], pImageOut, ImageLengthOut);
		}
		
		if(result == libSDK.UFE_OK) {
			SaveBytes(pImageOut, ImageLengthOut[0], "converted_to_19794_4.dat");
		}
		else {
			System.out.println(GetUFEErrorString(result));
		}
	}
	
	public static void OnGetImageBufferToBMPImageBuffer(){
		byte[] pImageOut = new byte[MAX_IMAGE_BUFFER_SIZE];
		int[] ImageLengthOut = new int[1];
		Scanner in = new Scanner(System.in);
		int result;

		if(mImageWidth > 1 && mImageHeight > 1) {
			result = libSDK.UFE_GetImageBufferToBMPImageBuffer(hExtractorContainer[0], mImage, mImageWidth, mImageHeight, pImageOut, ImageLengthOut);
		}
		else {
			byte[] pImage = new byte[MAX_IMAGE_BUFFER_SIZE];
			int[] pnWidth = new int[1];
			int[] pnHeight = new int[1];
			
			String imgPath;
			System.out.print("Image File Name (Finger1_1.bmp): ");
			imgPath = in.nextLine();
			if(imgPath.isEmpty()) {
				imgPath = "Finger1_1.bmp";
			}

			result = libSDK.UFE_LoadImageFromBMPFile(imgPath, pImage, pnWidth, pnHeight);
			mImageWidth = pnWidth[0];
			mImageHeight = pnHeight[0];
		
			result = libSDK.UFE_GetImageBufferToBMPImageBuffer(hExtractorContainer[0], pImage, pnWidth[0], pnHeight[0], pImageOut, ImageLengthOut);
		}
		
		if(result == libSDK.UFE_OK) {
			SaveBytes(pImageOut, ImageLengthOut[0], "converted_to_bmp.bmp");
		}
		else {
			System.out.println(GetUFEErrorString(result));
		}
	}
	
	public static void OnGetImageBufferToJPEGImageBuffer(){
		byte[] pImageOut = new byte[MAX_IMAGE_BUFFER_SIZE];
		int[] ImageLengthOut = new int[1];
		Scanner in = new Scanner(System.in);
		int result;

		if(mImageWidth > 1 && mImageHeight > 1) {
			result = libSDK.UFE_GetImageBufferToJPEGImageBuffer(hExtractorContainer[0], mImage, mImageWidth, mImageHeight, pImageOut, ImageLengthOut);
		}
		else {
			byte[] pImage = new byte[MAX_IMAGE_BUFFER_SIZE];
			int[] pnWidth = new int[1];
			int[] pnHeight = new int[1];
			
			String imgPath;
			System.out.print("Image File Name (Finger1_1.bmp): ");
			imgPath = in.nextLine();
			if(imgPath.isEmpty()) {
				imgPath = "Finger1_1.bmp";
			}

			result = libSDK.UFE_LoadImageFromBMPFile(imgPath, pImage, pnWidth, pnHeight);
			mImageWidth = pnWidth[0];
			mImageHeight = pnHeight[0];
		
			result = libSDK.UFE_GetImageBufferToJPEGImageBuffer(hExtractorContainer[0], pImage, pnWidth[0], pnHeight[0], pImageOut, ImageLengthOut);
		}
		
		if(result == libSDK.UFE_OK) {
			SaveBytes(pImageOut, ImageLengthOut[0], "converted_to_jpeg.jpeg");
		}
		else {
			System.out.println(GetUFEErrorString(result));
		}
	}
	
	public static void OnGetImageBufferToJP2ImageBuffer(){
		byte[] pImageOut = new byte[MAX_IMAGE_BUFFER_SIZE];
		int[] ImageLengthOut = new int[1];
		Scanner in = new Scanner(System.in);
		int result;

		if(mImageWidth > 1 && mImageHeight > 1) {
			result = libSDK.UFE_GetImageBufferToJP2ImageBuffer(hExtractorContainer[0], mImage, mImageWidth, mImageHeight, pImageOut, ImageLengthOut);
		}
		else {
			byte[] pImage = new byte[MAX_IMAGE_BUFFER_SIZE];
			int[] pnWidth = new int[1];
			int[] pnHeight = new int[1];
			
			String imgPath;
			System.out.print("Image File Name (Finger1_1.bmp): ");
			imgPath = in.nextLine();
			if(imgPath.isEmpty()) {
				imgPath = "Finger1_1.bmp";
			}

			result = libSDK.UFE_LoadImageFromBMPFile(imgPath, pImage, pnWidth, pnHeight);
			mImageWidth = pnWidth[0];
			mImageHeight = pnHeight[0];
		
			result = libSDK.UFE_GetImageBufferToJP2ImageBuffer(hExtractorContainer[0], pImage, pnWidth[0], pnHeight[0], pImageOut, ImageLengthOut);
		}
		
		if(result == libSDK.UFE_OK) {
			SaveBytes(pImageOut, ImageLengthOut[0], "converted_to_jp2.jp2");
		}
		else {
			System.out.println(GetUFEErrorString(result));
		}
	}
	
	public static void LoopConversion()
	{
		Scanner in = new Scanner(System.in);
		int usr_input = -1;
		boolean flag = true;
		while(flag){
			
			System.out.println("");
			System.out.println("===================================");
			System.out.println(" Suprema Image SDK File format Conversion");
			System.out.println("===================================");
			System.out.println(" 1: Convert To 19794-4");
			System.out.println(" 2: Convert To BMP");
			System.out.println(" 3: Convert To JPEG");
			System.out.println(" 4: Convert To JP2");
			System.out.println(" 0: Return to main menu");
			System.out.print("Enter your selection : ");
			usr_input = in.nextInt();
			
			switch(usr_input){
			case 1: OnGetImageBufferTo19794_4ImageBuffer(); break;
			case 2: OnGetImageBufferToBMPImageBuffer(); break;
			case 3: OnGetImageBufferToJPEGImageBuffer(); break;
			case 4: OnGetImageBufferToJP2ImageBuffer(); break;
			case 0: flag = false; break;	
			default: break;
			}
		}
	}
	
	public static void LoopConfig()
	{
		Scanner in = new Scanner(System.in);
		int usr_input = -1;
		boolean flag = true;
		while(flag){
			System.out.println("");
			System.out.println("===================================");
			System.out.println(" Suprema Image SDK Configuration");
			System.out.println("===================================");
			System.out.println(" 1: Set Parameters");
			System.out.println(" 2: Get Parameters");
			System.out.println(" 3: Set Template Type");
			System.out.println(" 4: Get Template Type");
			System.out.println(" 0: Return to main menu");
			System.out.print("Enter your selection : ");
			usr_input = in.nextInt();
			
			switch(usr_input){
			case 1: OnSetParameter(); break;
			case 2: OnGetParameter(); break;
			case 3: OnSetTemplateType(); break;
			case 4: OnGetTemplateType(); break;
			case 0: flag = false; break;	
			default: break;
			}
		}
	}

	public static void LoopMain()
	{
		Scanner in = new Scanner(System.in);
		int usr_input = -1;
		boolean flag = true;
		while(flag){
			
			System.out.println("");
			System.out.println("===================================");
			System.out.println(" Suprema Image SDK JNI Demo");
			System.out.println("===================================");
			System.out.println(" 1: Init");
			System.out.println(" 2: UnInit");
			System.out.println(" 3: Load image from BMP");
			System.out.println(" 4: Load image from BMP (mem)");
			System.out.println(" 5: Load image from WSQ");
			System.out.println(" 6: Load image from WSQ (mem)");
			System.out.println(" 7: Verification");
			System.out.println(" 8: Identify");
			System.out.println(" 9: Extract");
			System.out.println("10: Configuration");
			System.out.println("11: Format conversion");
			System.out.println(" 0: Exit");
			System.out.print("Enter your selection : ");
			usr_input = in.nextInt();
			
			switch(usr_input){
			case 1: OnInit(); break;
			case 2: OnDelete(); break;
			case 3: OnLoadImageFromBMPFile(); break;
			case 4: OnLoadImageFromBMPBuffer(); break;
			case 5: OnLoadImageFromWSQFile(); break;
			case 6: OnLoadImageFromWSQBuffer(); break;
			case 7: OnVerify(); break;
			case 8: OnIdentify(); break;
			case 9: OnExtract(); break;
			case 10: LoopConfig(); break;
			case 11: LoopConversion(); break;
			case 0: flag = false; break;	
			default:
				break;
			}
		}
	}
	
	public static void main(String[] args)
	{	
		LoopMain();
	}
}
