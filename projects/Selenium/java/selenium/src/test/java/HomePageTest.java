import org.junit.jupiter.api.Test;
import org.openqa.selenium.By;
import org.openqa.selenium.WebDriver;
import org.openqa.selenium.WebElement;
import org.openqa.selenium.chrome.ChromeOptions;
import org.openqa.selenium.remote.RemoteWebDriver;

import java.net.MalformedURLException;
import java.net.URI;
import java.util.ArrayList;
import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

class HomePageTest {
    @Test 
    void titleTest() throws Exception {
        ChromeOptions options = new ChromeOptions();

        WebDriver driver = new RemoteWebDriver(
                URI.create("http://selenium:4444").toURL(),
                options
        );

        driver.get("https://saisakthi.qzz.io/");

        assertEquals("Saisakthi M — Backend Developer", driver.getTitle());

        driver.quit(); 
    };
    @Test 
    void subTitleTest() throws Exception {
        ChromeOptions options = new ChromeOptions();

        WebDriver driver = new RemoteWebDriver(
                URI.create("http://selenium:4444").toURL(),
                options
        );

        driver.get("https://saisakthi.qzz.io/");

        assertTrue(driver.findElement(By.className("section-title.reveal.visible")).isDisplayed());

        List<WebElement> elements = driver.findElements(By.cssSelector(".section-title.reveal.visible"));
        ArrayList<String> string_elements = new ArrayList<String>();
        for (WebElement element : elements) {
            string_elements.add(element.getText());
        }
        assertEquals("Tech Stack", string_elements.get(0));
        assertEquals("What I've Built", string_elements.get(1));
        assertEquals("Pentest — Own Infrastructure", string_elements.get(2));
        assertEquals("Open Source", string_elements.get(3));
        assertEquals("Get In Touch", string_elements.get(4));
        driver.quit(); 
    };
    @Test 
    void heroTest() throws Exception {
        ChromeOptions options = new ChromeOptions();
        WebDriver driver = new RemoteWebDriver(URI.create("http://selenium:4444").toURL(),options);
        driver.get("https://saisakthi.qzz.io/");
        assertEquals("Saisakthi.M", driver.findElement(By.className("hero-name")).getText());
        assertEquals("Backend-focused Full-Stack Developer", driver.findElement(By.className("hero-role")).getText());
        assertEquals("Self-taught developer building production-grade systems — containerized infrastructure,\n" + //
                    "microservices, and security-aware APIs. Comfort zone: Django, Spring Boot, Docker, Kubernetes.", driver.findElement(By.className("hero-dec")).getText());
        driver.quit();

    }


}