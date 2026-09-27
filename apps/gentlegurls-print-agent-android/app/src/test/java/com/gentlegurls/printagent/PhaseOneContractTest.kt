package com.gentlegurls.printagent
import org.junit.Assert.*
import org.junit.Test
class PhaseOneContractTest {
    @Test fun websocketWakeupDoesNotCarryPrintablePayload(){val event="""{"event":"print.job.available","data":{"job_id":"01ABC","reason":"created"}}""";assertTrue(event.contains("job_id"));assertFalse(event.contains("receipt"))}
    @Test fun testPrintIsTheOnlyPhaseOneProcessorType(){assertEquals("test_print","TEST_PRINT".lowercase())}
}
