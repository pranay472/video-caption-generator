import DemoSection from "../components/DemoSection";
import PageHeaders from "../components/PageHeaders";
import UploadForm from "../components/UploadForm";

export default function Home() {
  return (
    <>
      <PageHeaders
      h1Text={'The Future of AI-Powered Video Enhancement'}
      h2Text={'Just upload the video and leave the rest to us'}/>
      <div className="text-center">
       <UploadForm/>
      </div>
      <DemoSection/>
    </>  
  );
}
