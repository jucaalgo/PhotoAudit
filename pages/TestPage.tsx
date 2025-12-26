import React, { useEffect } from 'react';

const TestPage = () => {
    useEffect(() => { console.log("TestPage Mounted"); }, []);
    return <div className="text-white p-10">Test Page - If this flickers or logs repeatedly, App is looping.</div>;
};

export default TestPage;
